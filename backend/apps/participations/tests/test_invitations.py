from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch

from django.core.cache import cache
from django.db import connections
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import User, VolunteerProfile
from apps.notifications.models import Notification, EmailDelivery
from apps.reports.models import AuditEvent
from .. import invitations, services
from ..models import Invitation, Participation
from .test_api import fixtures


class InvitationTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.one, self.two, self.activity = fixtures()
        for user in [self.one, self.two]:
            VolunteerProfile.objects.create(user=user, matching_visible=True)
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.owner)
        self.url = f'/api/v1/organizer/activities/{self.activity.pk}/invitations/'

    def post(self, url, data=None):
        token = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        return self.client.post(url, data or {}, format='json', HTTP_X_CSRFTOKEN=token)

    def invite(self, user=None):
        return invitations.send(self.activity.pk, self.owner, (user or self.one).pk, 'Mời bạn cùng tham gia')[0]

    def test_send_accept_auto_approves_and_retry_does_not_duplicate(self):
        first = self.post(self.url, {'volunteer': str(self.one.pk), 'message': 'Mời bạn'})
        self.assertEqual(first.status_code, 201)
        self.assertEqual(Participation.objects.count(), 0)
        self.assertEqual(self.post(self.url, {'volunteer': str(self.one.pk)}).status_code, 200)
        self.assertEqual(Notification.objects.filter(kind='invitation').count(), 1)
        self.assertEqual(EmailDelivery.objects.count(), 1)
        self.assertNotIn('email', str(first.data))
        self.client.force_login(self.one)
        response_url = f'/api/v1/invitations/{first.data["id"]}/respond/'
        self.assertEqual(self.post(response_url, {'status': 'accepted'}).status_code, 200)
        self.assertEqual(self.post(response_url, {'status': 'accepted'}).status_code, 200)
        entry = Participation.objects.get()
        self.assertEqual(entry.status, 'approved')
        self.assertEqual(entry.reviewed_by, self.owner)
        self.assertEqual(entry.registered_address, self.activity.address)
        self.assertEqual(AuditEvent.objects.filter(action='invitation_accepted').count(), 1)
        self.assertEqual(AuditEvent.objects.filter(action='review_approved').count(), 1)
        self.assertEqual(Notification.objects.filter(kind='invitation_response').count(), 1)
        self.assertEqual(self.post(response_url, {'status': 'declined'}).status_code, 400)
        # Replaying a successful acceptance cannot undo a later cancellation.
        services.cancel(self.activity.pk, self.one)
        self.assertEqual(self.post(response_url, {'status': 'accepted'}).status_code, 200)
        entry.refresh_from_db()
        self.assertEqual(entry.status, 'cancelled')

    def test_permissions_csrf_private_lists_and_opt_in(self):
        self.assertEqual(self.client.post(self.url, {'volunteer': str(self.one.pk)}, format='json').status_code, 403)
        self.assertEqual(self.post(self.url, {'volunteer': str(self.one.pk), 'status': 'accepted'}).status_code, 400)
        VolunteerProfile.objects.filter(user=self.one).update(matching_visible=False)
        self.assertEqual(self.post(self.url, {'volunteer': str(self.one.pk)}).status_code, 404)
        VolunteerProfile.objects.filter(user=self.one).update(matching_visible=True)
        item = self.invite()
        other = User.objects.create_user('invite.other@example.invalid', role='organizer', full_name='Khác')
        self.client.force_login(other)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.assertEqual(self.post(self.url, {'volunteer': str(self.two.pk)}).status_code, 404)
        self.assertEqual(self.post(self.url + f'{item.pk}/withdraw/').status_code, 404)
        self.client.force_login(self.two)
        self.assertEqual(self.client.get('/api/v1/invitations/').data['count'], 0)
        self.assertEqual(self.post(f'/api/v1/invitations/{item.pk}/respond/', {'status': 'accepted'}).status_code, 404)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.client.force_login(self.one)
        result = self.client.get('/api/v1/invitations/')
        self.assertEqual(result.data['count'], 1)
        self.assertIn('no-store', result['Cache-Control'])
        self.client.logout()
        self.assertEqual(self.client.get('/api/v1/invitations/').status_code, 401)

    def test_decline_withdraw_are_final_without_resend(self):
        item = self.invite()
        invitations.respond(item.pk, self.one, 'declined')
        invitations.respond(item.pk, self.one, 'declined')
        self.assertEqual(self.invite().status, 'declined')
        self.assertEqual(Notification.objects.filter(kind='invitation').count(), 1)
        with self.assertRaises(ValidationError):
            invitations.respond(item.pk, self.one, 'accepted')
        second = self.invite(self.two)
        self.assertEqual(self.post(self.url + f'{second.pk}/withdraw/').status_code, 200)
        self.assertEqual(self.post(self.url + f'{second.pk}/withdraw/').status_code, 200)
        with self.assertRaises(ValidationError):
            invitations.respond(second.pk, self.two, 'accepted')
        self.assertEqual(Participation.objects.count(), 0)

    def test_capacity_checked_at_acceptance_not_reserved(self):
        first, second = self.invite(), self.invite(self.two)
        invitations.respond(first.pk, self.one, 'accepted')
        with self.assertRaises(ValidationError):
            invitations.respond(second.pk, self.two, 'accepted')
        second.refresh_from_db()
        self.assertEqual(second.status, 'pending')
        self.client.force_login(self.two)
        self.assertIn('đủ chỗ', self.client.get('/api/v1/invitations/').data['results'][0]['unavailable_reason'])
        services.cancel(self.activity.pk, self.one)
        invitations.respond(second.pk, self.two, 'accepted')
        self.assertEqual(Participation.objects.filter(status='approved').count(), 1)

    def test_deadline_cancelled_and_inactive_organizer_block_acceptance(self):
        item = self.invite()
        with patch('apps.participations.services.timezone.now', return_value=self.activity.starts_at):
            with self.assertRaises(ValidationError):
                invitations.respond(item.pk, self.one, 'accepted')
            with self.assertRaises(ValidationError):
                self.invite(self.two)
        for status in ['draft', 'cancelled', 'completed']:
            self.activity.status = status
            self.activity.save(update_fields=['status'])
            with self.assertRaises(ValidationError):
                invitations.respond(item.pk, self.one, 'accepted')
        self.activity.status = 'published'
        self.activity.save(update_fields=['status'])
        self.owner.is_active = False
        self.owner.save(update_fields=['is_active'])
        with self.assertRaises(ValidationError):
            invitations.respond(item.pk, self.one, 'accepted')
        self.assertEqual(Participation.objects.count(), 0)

    def test_pending_can_accept_but_rejected_cannot(self):
        item = self.invite()
        second = self.invite(self.two)
        entry = services.register(self.activity.pk, self.one)
        invitations.respond(item.pk, self.one, 'accepted')
        self.assertEqual(Participation.objects.count(), 1)
        services.cancel(self.activity.pk, self.one)
        pending = services.register(self.activity.pk, self.two)
        services.review(self.activity.pk, pending.pk, self.owner, 'rejected')
        with self.assertRaises(ValidationError):
            invitations.respond(second.pk, self.two, 'accepted')

    def test_self_cancelled_registration_can_accept_invitation(self):
        entry = services.register(self.activity.pk, self.one)
        services.cancel(self.activity.pk, self.one)
        item = self.invite()
        invitations.respond(item.pk, self.one, 'accepted')
        entry.refresh_from_db()
        self.assertEqual(entry.status, 'approved')

    def test_schedule_changes_use_current_information_and_opt_out_preserves_received_invite(self):
        item = self.invite()
        self.activity.address = 'Địa điểm mới'
        self.activity.save(update_fields=['address'])
        VolunteerProfile.objects.filter(user=self.one).update(matching_visible=False)
        self.client.force_login(self.one)
        self.assertTrue(self.client.get('/api/v1/invitations/').data['results'][0]['activity_changed'])
        invitations.respond(item.pk, self.one, 'accepted')
        self.assertEqual(Participation.objects.get().registered_address, 'Địa điểm mới')

    def test_audit_failure_rolls_back_invitation_acceptance_and_outbox(self):
        with patch('apps.participations.invitations.record', side_effect=RuntimeError):
            with self.assertRaises(RuntimeError):
                self.invite()
        self.assertEqual(Invitation.objects.count(), 0)
        self.assertEqual(Notification.objects.count(), 0)
        item = self.invite()
        with patch('apps.participations.invitations.record', side_effect=RuntimeError):
            with self.assertRaises(RuntimeError):
                invitations.respond(item.pk, self.one, 'accepted')
        item.refresh_from_db()
        self.assertEqual(item.status, 'pending')
        self.assertEqual(Participation.objects.count(), 0)
        self.assertEqual(Notification.objects.count(), 1)
        self.assertFalse(AuditEvent.objects.filter(action='review_approved').exists())


class ConcurrentInvitationTests(TransactionTestCase):
    def test_two_invitations_compete_for_last_place(self):
        owner, one, two, activity = fixtures()
        for user in [one, two]:
            VolunteerProfile.objects.create(user=user, matching_visible=True)
        first = invitations.send(activity.pk, owner, one.pk)[0]
        second = invitations.send(activity.pk, owner, two.pk)[0]
        barrier = Barrier(2)

        def accept(item_id, user_id):
            connections.close_all()
            try:
                user = User.objects.get(pk=user_id)
                barrier.wait(timeout=10)
                try:
                    invitations.respond(item_id, user, 'accepted')
                    return 'accepted'
                except ValidationError:
                    return 'full'
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(accept, item.pk, user.pk) for item, user in [(first, one), (second, two)]]
            self.assertCountEqual([future.result(timeout=30) for future in futures], ['accepted', 'full'])
        self.assertEqual(Participation.objects.filter(status='approved').count(), 1)

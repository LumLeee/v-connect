from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import VolunteerProfile
from apps.participations import checkin, services
from apps.participations.contributions import confirm
from apps.participations.invitations import send, respond
from apps.participations.models import AttendanceCode
from apps.participations.tests.test_api import fixtures
from apps.reports.leaderboard import totals
from ..models import Activity


@override_settings(ACTIVITY_TIME_CHECKS_ENABLED=False)
class DemoTimePolicyTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.one, self.two, self.activity = fixtures()

    def test_publish_register_review_checkin_complete_score_and_feedback_without_waiting(self):
        for offset in [-2, 2]:
            now = timezone.now()
            activity = Activity.objects.create(organizer=self.owner, title='Thử không chờ', description='Nội dung', address='Huế',
                capacity=2, starts_at=now+timedelta(days=offset), ends_at=now+timedelta(days=offset, hours=1))
            base = f'/api/v1/organizer/activities/{activity.pk}/'
            self.client.force_login(self.owner)
            self.assertEqual(self.client.post(base+'status/', {'status': 'published'}, format='json').status_code, 200)
            activity.refresh_from_db()
            self.client.force_login(self.one)
            response = self.client.post(f'/api/v1/activities/{activity.pk}/participation/', {}, format='json')
            self.assertEqual(response.status_code, 201)
            entry_id = response.data['participation']['id']
            self.assertTrue(response.data['participation']['activity']['time_checks_disabled'])
            self.client.force_login(self.owner)
            self.assertEqual(self.client.post(base+f'applicants/{entry_id}/review/', {'status': 'approved'}, format='json').status_code, 200)
            code = checkin.issue(activity.pk, self.owner)
            self.assertTrue(code['active'])
            self.assertTrue(code['time_checks_disabled'])
            # Expired session time is ignored only in demo mode; credentials still required.
            AttendanceCode.objects.filter(activity=activity).update(expires_at=now-timedelta(minutes=1))
            self.assertTrue(checkin.session_data(activity)['active'])
            attendance, _ = checkin.check_in(activity.pk, self.one, {'code': code['code']})
            self.assertEqual(self.client.post(base+'status/', {'status': 'completed'}, format='json').status_code, 200)
            confirm(self.owner, activity.pk, attendance.pk, {'score': 8, 'revision': 0, 'reason': ''})
            self.client.force_login(self.one)
            self.assertTrue(self.client.get(f'/api/v1/activities/{activity.pk}/feedback/').data['can_submit'])
            self.assertEqual(self.client.post(f'/api/v1/activities/{activity.pk}/feedback/', {'rating': 5, 'content': 'Đã thử'}, format='json').status_code, 201)
            self.client.force_login(self.owner)
            self.assertEqual(self.client.get(f'/api/v1/reports/activities/{activity.pk}/summary-document/').status_code, 200)
        self.assertEqual(totals().get(pk=self.one.pk).total_score, 16)
        self.client.force_login(self.one)
        self.assertEqual(self.client.get('/api/v1/contributions/').data['summary']['score'], 16)

    def test_manual_attendance_and_invitations_after_deadline(self):
        self.activity.starts_at = timezone.now()-timedelta(days=2)
        self.activity.ends_at = timezone.now()-timedelta(days=1)
        self.activity.save()
        VolunteerProfile.objects.create(user=self.one, matching_visible=True)
        invitation, _ = send(self.activity.pk, self.owner, self.one.pk)
        respond(invitation.pk, self.one, 'accepted')
        entry = self.activity.participations.get()
        services.confirm_attendance(self.activity.pk, entry.pk, self.owner)
        self.client.force_login(self.one)
        self.assertEqual(self.client.get('/api/v1/activities/').data['count'], 0)  # Still hide full activities.
        services.cancel(self.activity.pk, self.one)
        self.assertEqual(self.client.get('/api/v1/activities/').data['count'], 1)

    def test_normal_mode_reenables_time_gates_and_demo_keeps_state_guards(self):
        from rest_framework.exceptions import ValidationError
        entry = services.register(self.activity.pk, self.one)
        services.review(self.activity.pk, entry.pk, self.owner, 'approved')
        with override_settings(ACTIVITY_TIME_CHECKS_ENABLED=True):
            with self.assertRaises(ValidationError):
                services.confirm_attendance(self.activity.pk, entry.pk, self.owner)
            with patch('django.utils.timezone.now', return_value=self.activity.ends_at+timedelta(days=1)):
                with self.assertRaises(ValidationError):
                    services.cancel(self.activity.pk, self.one)
        self.activity.status = 'cancelled'
        self.activity.save(update_fields=['status'])
        with self.assertRaises(ValidationError):
            services.register(self.activity.pk, self.two)
        with self.assertRaises(ValidationError):
            services.confirm_attendance(self.activity.pk, entry.pk, self.owner)

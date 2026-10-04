from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch
from io import StringIO

from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from django.db import connections, transaction
from django.test import TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import User
from apps.activities.models import Activity
from apps.feedback import services as feedback
from apps.participations import services as participations
from apps.participations.models import Participation
from .delivery import create_reminders, deliver_emails
from .models import EmailDelivery, Notification, NotificationPreference
from .services import notify


def fixtures():
    owner = User.objects.create_user('notify.org@example.invalid', full_name='Nhà tổ chức', role='organizer')
    one = User.objects.create_user('notify.one@example.invalid', full_name='Người tham gia')
    two = User.objects.create_user('notify.two@example.invalid', full_name='Người khác')
    now = timezone.now()
    activity = Activity.objects.create(organizer=owner, title='Ngày hội xanh', description='Cùng tham gia',
        address='Huế', starts_at=now + timedelta(days=2), ends_at=now + timedelta(days=2, hours=2),
        capacity=10, status='published', published_at=now)
    return owner, one, two, activity


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class NotificationTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.one, self.two, self.activity = fixtures()
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.one)
        self.base = '/api/v1/notifications/'

    def mutation(self, path, data=None, method='post'):
        token = self.client.get('/api/v1/auth/csrf/').data['csrfToken']
        return getattr(self.client, method)(path, data or {}, format='json', HTTP_X_CSRFTOKEN=token)

    def approved(self):
        entry = participations.register(self.activity.pk, self.one)
        return participations.review(self.activity.pk, entry.pk, self.owner, 'approved')

    def reminder_entry(self):
        entry = self.approved()
        self.activity.starts_at = timezone.now() + timedelta(minutes=50)
        self.activity.ends_at = self.activity.starts_at + timedelta(hours=2)
        self.activity.save()
        entry.reviewed_at = timezone.now() - timedelta(hours=2)
        entry.save()
        return entry

    def test_owner_only_pagination_filters_and_csrf(self):
        mine = notify(self.one, 'test', 'Của tôi', 'Nội dung')
        other = notify(self.two, 'test', 'Riêng tư', 'Không được thấy')
        self.assertEqual(self.client.get(self.base).data['count'], 1)
        self.assertNotContains(self.client.get(self.base), 'Riêng tư')
        self.assertEqual(self.client.get(self.base + 'unread-count/').data['count'], 1)
        self.assertEqual(self.client.post(f'{self.base}{mine.pk}/read/', {}).status_code, 403)
        self.assertEqual(self.mutation(f'{self.base}{other.pk}/read/').status_code, 404)
        self.assertEqual(self.mutation(f'{self.base}{mine.pk}/read/', {'recipient': str(self.two.pk)}).status_code, 400)
        self.assertEqual(self.mutation(f'{self.base}{mine.pk}/read/').data['updated'], 1)
        mine.refresh_from_db()
        first_read = mine.read_at
        self.assertEqual(self.mutation(f'{self.base}{mine.pk}/read/').data['updated'], 0)
        mine.refresh_from_db()
        self.assertEqual(first_read, mine.read_at)
        self.assertEqual(self.client.get(self.base + '?state=read').data['count'], 1)
        self.assertEqual(self.client.get(self.base + '?state=unread').data['count'], 0)
        self.assertEqual(self.client.get(self.base + '?state=bad').status_code, 400)
        self.mutation(self.base + 'read-all/')
        other.refresh_from_db()
        self.assertIsNone(other.read_at)
        self.client.logout()
        self.assertEqual(self.client.get(self.base).status_code, 401)

    def test_preferences_validate_and_do_not_affect_other_users(self):
        url = self.base + 'preferences/'
        self.assertTrue(self.client.get(url).data['email_enabled'])
        self.assertEqual(self.client.patch(url, {'email_enabled': False}, format='json').status_code, 403)
        self.assertEqual(self.mutation(url, {'email_enabled': 'false'}, 'patch').status_code, 400)
        self.assertEqual(self.mutation(url, {'email_enabled': False, 'user': str(self.two.pk)}, 'patch').status_code, 400)
        self.assertEqual(self.mutation(url, {'email_enabled': False}, 'patch').status_code, 200)
        notify(self.one, 'test', 'Không gửi mail', 'Nội dung')
        self.assertEqual(Notification.objects.count(), 1)
        self.assertEqual(EmailDelivery.objects.count(), 0)
        self.client.force_login(self.two)
        self.assertTrue(self.client.get(url).data['email_enabled'])

    def test_pagination_and_mark_all_include_records_beyond_current_page(self):
        for index in range(25):
            notify(self.one, 'test', f'Thông báo {index}', 'Nội dung')
        notify(self.two, 'test', 'Của người khác', 'Nội dung')
        page_one = self.client.get(self.base + '?page_size=12').data
        page_two = self.client.get(self.base + '?page_size=12&page=2').data
        self.assertEqual(page_one['count'], 25)
        self.assertEqual(len(page_one['results']), 12)
        self.assertFalse({item['id'] for item in page_one['results']} & {item['id'] for item in page_two['results']})
        self.assertEqual(self.mutation(self.base + 'read-all/').data['updated'], 25)
        self.assertEqual(self.client.get(self.base + '?state=unread').data['count'], 0)
        self.assertEqual(Notification.objects.filter(recipient=self.two, read_at__isnull=True).count(), 1)

    def test_register_cancel_reregister_review_notifications(self):
        entry = participations.register(self.activity.pk, self.one)
        participations.cancel(self.activity.pk, self.one)
        participations.register(self.activity.pk, self.one)
        participations.review(self.activity.pk, entry.pk, self.owner, 'rejected')
        self.assertEqual(Notification.objects.filter(recipient=self.owner).count(), 3)
        self.assertEqual(Notification.objects.get(recipient=self.one).kind, 'review_rejected')
        self.assertEqual(EmailDelivery.objects.count(), 4)

    def test_notifications_rollback_with_business_transaction(self):
        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                participations.register(self.activity.pk, self.one)
                raise RuntimeError('abort')
        self.assertFalse(Participation.objects.exists())
        self.assertFalse(Notification.objects.exists())
        self.assertFalse(EmailDelivery.objects.exists())

    def test_activity_changes_only_notify_eligible_people_and_actual_changes(self):
        self.approved()
        other = participations.register(self.activity.pk, self.two)
        participations.review(self.activity.pk, other.pk, self.owner, 'rejected')
        Notification.objects.all().delete()
        self.client.force_login(self.owner)
        url = f'/api/v1/organizer/activities/{self.activity.pk}/'
        self.assertEqual(self.mutation(url, {'title': 'Tiêu đề mới'}, 'patch').status_code, 200)
        self.assertFalse(Notification.objects.exists())
        self.assertEqual(self.mutation(url, {'address': 'Đà Nẵng'}, 'patch').status_code, 200)
        self.assertEqual(Notification.objects.get().recipient, self.one)
        self.assertEqual(self.mutation(url, {'address': 'Đà Nẵng'}, 'patch').status_code, 200)
        self.assertEqual(Notification.objects.count(), 1)
        self.assertEqual(self.mutation(url + 'status/', {'status': 'cancelled'}).status_code, 200)
        self.assertEqual(Notification.objects.filter(kind='activity_cancelled', recipient=self.one).count(), 1)
        self.assertEqual(Notification.objects.filter(recipient=self.two).count(), 0)

    def test_attendance_and_moderation_retries_do_not_duplicate(self):
        entry = self.approved()
        with patch('apps.participations.services.timezone.now', return_value=self.activity.starts_at):
            participations.confirm_attendance(self.activity.pk, entry.pk, self.owner)
            participations.confirm_attendance(self.activity.pk, entry.pk, self.owner)
        self.assertEqual(Notification.objects.filter(kind='attendance').count(), 1)
        self.activity.status = 'completed'
        self.activity.save()
        with patch('apps.feedback.services.timezone.now', return_value=self.activity.ends_at + timedelta(seconds=1)):
            result = feedback.submit(self.activity.pk, self.one, {'rating': 5, 'content': 'Hữu ích'})
        admin = User.objects.create_superuser('notificationadmin', full_name='Admin')
        feedback.hide(result.pk, admin, 'Nội dung cần kiểm tra')
        feedback.hide(result.pk, admin, 'Lặp lại')
        self.assertEqual(Notification.objects.filter(kind='feedback_received', recipient=self.owner).count(), 1)
        self.assertEqual(Notification.objects.filter(kind='feedback_hidden', recipient=self.one).count(), 1)

    def test_reminder_once_at_one_hour_and_skip_late_approval(self):
        entry = self.approved()
        Notification.objects.all().delete()
        with patch('django.utils.timezone.now', return_value=self.activity.starts_at - timedelta(hours=1, seconds=1)):
            self.assertEqual(create_reminders(), 0)
        with patch('django.utils.timezone.now', return_value=self.activity.starts_at - timedelta(hours=1)):
            self.assertEqual(create_reminders(), 1)
            self.assertEqual(create_reminders(), 0)
        self.assertEqual(Notification.objects.get().kind, 'reminder')
        Notification.objects.all().delete()
        entry.reviewed_at = self.activity.starts_at - timedelta(minutes=59)
        entry.save()
        with patch('django.utils.timezone.now', return_value=self.activity.starts_at - timedelta(minutes=30)):
            self.assertEqual(create_reminders(), 0)
        with patch('django.utils.timezone.now', return_value=self.activity.starts_at):
            self.assertEqual(create_reminders(), 0)

    def test_reminders_skip_inactive_cancelled_and_pending(self):
        entry = self.reminder_entry()
        for status in ['pending', 'cancelled', 'rejected']:
            entry.status = status
            entry.save()
            self.assertEqual(create_reminders(), 0)
        entry.status = 'approved'
        entry.save()
        self.one.is_active = False
        self.one.save()
        self.assertEqual(create_reminders(), 0)

    def test_reschedule_can_create_new_reminder_and_old_email_is_skipped(self):
        self.reminder_entry()
        Notification.objects.all().delete()
        self.assertEqual(create_reminders(), 1)
        old = EmailDelivery.objects.get()
        self.activity.starts_at += timedelta(minutes=5)
        self.activity.save()
        self.assertEqual(create_reminders(), 1)
        deliver_emails()
        old.refresh_from_db()
        self.assertEqual(old.status, 'skipped')
        self.assertEqual(len(mail.outbox), 1)

    def test_cancelled_reminder_email_is_skipped(self):
        self.reminder_entry()
        Notification.objects.all().delete()
        create_reminders()
        participations.cancel(self.activity.pk, self.one)
        Notification.objects.exclude(kind='reminder').delete()
        deliver_emails()
        self.assertEqual(EmailDelivery.objects.get().status, 'skipped')
        self.assertEqual(len(mail.outbox), 0)

    def test_expired_reminder_and_locked_user_emails_are_not_sent(self):
        self.reminder_entry()
        Notification.objects.all().delete()
        create_reminders()
        with patch('django.utils.timezone.now', return_value=self.activity.starts_at):
            deliver_emails()
        self.assertEqual(EmailDelivery.objects.get().status, 'skipped')
        notify(self.two, 'test', 'Trước khi khóa', 'Nội dung')
        self.two.is_active = False
        self.two.save()
        deliver_emails()
        self.assertEqual(EmailDelivery.objects.filter(status='skipped').count(), 2)
        self.assertEqual(len(mail.outbox), 0)

    def test_email_content_and_dedupe(self):
        notify(self.one, 'test', 'Kết quả', 'Nội dung tiếng Việt', self.activity, dedupe_key='same')
        notify(self.one, 'test', 'Kết quả', 'Nội dung tiếng Việt', self.activity, dedupe_key='same')
        self.assertEqual(deliver_emails(), 1)
        self.assertEqual(deliver_emails(), 0)
        self.assertEqual(mail.outbox[0].to, [self.one.email])
        self.assertIn(f'/hoat-dong/{self.activity.pk}', mail.outbox[0].body)
        self.assertIn('Nội dung tiếng Việt', mail.outbox[0].body)
        self.assertEqual(EmailDelivery.objects.get().status, 'sent')

    def test_email_optout_after_queue_and_no_email_admin(self):
        notify(self.one, 'test', 'Tắt sau khi xếp hàng', 'Nội dung')
        NotificationPreference.objects.create(user=self.one, email_enabled=False)
        admin = User.objects.create_superuser('mailadmin', full_name='Admin')
        notify(admin, 'test', 'Không có email', 'Nội dung')
        deliver_emails()
        self.assertEqual(Notification.objects.count(), 2)
        self.assertEqual(EmailDelivery.objects.get().status, 'skipped')
        self.assertEqual(len(mail.outbox), 0)

    def test_email_failure_backoff_limit_and_safe_error(self):
        notify(self.one, 'test', 'Email lỗi', 'Nội dung')
        with patch('apps.notifications.delivery.EmailMessage.send', side_effect=RuntimeError('SMTP secret')):
            for attempt in range(1, 6):
                EmailDelivery.objects.update(available_at=timezone.now() - timedelta(seconds=1))
                self.assertEqual(deliver_emails(), 1)
                job = EmailDelivery.objects.get()
                self.assertEqual(job.attempts, attempt)
                self.assertEqual(job.last_error, 'delivery_failed')
                self.assertEqual(job.status, 'failed' if attempt == 5 else 'pending')
                self.assertEqual(deliver_emails(), 0)

    def test_abandoned_claim_recovered_but_active_claim_untouched(self):
        notify(self.one, 'test', 'Email', 'Nội dung')
        EmailDelivery.objects.update(status='sending', attempts=1, locked_at=timezone.now())
        self.assertEqual(deliver_emails(), 0)
        EmailDelivery.objects.update(locked_at=timezone.now() - timedelta(minutes=16))
        self.assertEqual(deliver_emails(), 1)
        self.assertEqual(EmailDelivery.objects.get().attempts, 2)


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class NotificationConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.owner, self.one, self.two, self.activity = fixtures()

    def test_command_creates_reminder_then_delivers_queued_email(self):
        # The worker manages DB connection lifetime, so exercise it outside the
        # artificial outer transaction supplied by APITestCase/TestCase.
        entry = participations.register(self.activity.pk, self.one)
        participations.review(self.activity.pk, entry.pk, self.owner, 'approved')
        self.activity.starts_at = timezone.now() + timedelta(minutes=50)
        self.activity.save()
        Participation.objects.filter(pk=entry.pk).update(reviewed_at=timezone.now() - timedelta(hours=2))
        Notification.objects.all().delete()
        output = StringIO()
        call_command('process_notifications', reminders_only=True, stdout=output)
        self.assertEqual(Notification.objects.get().kind, 'reminder')
        self.assertEqual(EmailDelivery.objects.get().status, 'pending')
        call_command('process_notifications', stdout=output)
        self.assertEqual(EmailDelivery.objects.get().status, 'sent')
        self.assertEqual(len(mail.outbox), 1)

    def parallel(self, action):
        barrier = Barrier(2)
        def run():
            connections.close_all()
            try:
                barrier.wait(timeout=10)
                return action()
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            return list(pool.map(lambda _: run(), range(2)))

    def test_two_workers_claim_email_once(self):
        notify(self.one, 'test', 'Nội dung', 'Thông báo')
        with patch('apps.notifications.delivery.EmailMessage.send', return_value=1) as send:
            self.assertEqual(sum(self.parallel(lambda: deliver_emails(limit=1))), 1)
            self.assertEqual(send.call_count, 1)

    def test_two_workers_create_one_reminder(self):
        entry = participations.register(self.activity.pk, self.one)
        participations.review(self.activity.pk, entry.pk, self.owner, 'approved')
        self.activity.starts_at = timezone.now() + timedelta(minutes=50)
        self.activity.save()
        Participation.objects.filter(pk=entry.pk).update(reviewed_at=timezone.now() - timedelta(hours=2))
        self.assertEqual(sum(self.parallel(create_reminders)), 1)
        self.assertEqual(Notification.objects.filter(kind='reminder').count(), 1)

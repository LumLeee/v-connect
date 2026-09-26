from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

from django.core.cache import cache
from django.db import connections
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.activities.models import Activity
from apps.participations.models import Attendance, Participation
from apps.participations.tests import fixtures
from apps.participations import services
from apps.reports.services import metrics_for


class CrossWorkflowConcurrencyTests(TransactionTestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.one, self.two, self.activity = fixtures()
        self.base = f'/api/v1/organizer/activities/{self.activity.pk}/'

    def organizer_request(self, method, url, body):
        client = APIClient()
        client.force_authenticate(self.owner)
        return getattr(client, method)(url, body, format='json').status_code

    def parallel(self, actions):
        barrier = Barrier(len(actions))
        def execute(action):
            connections.close_all()
            try:
                barrier.wait(timeout=10)
                return action()
            except ValidationError:
                return 400
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=len(actions)) as pool:
            return list(pool.map(execute, actions))

    def test_registration_racing_activity_cancellation_never_leaves_active_entry(self):
        def register():
            services.register(self.activity.pk, self.one)
            return 201
        results = self.parallel([register, lambda: self.organizer_request('post', self.base + 'status/', {'status': 'cancelled'})])
        self.assertEqual(results[1], 200)
        self.assertIn(results[0], [201, 400])
        self.activity.refresh_from_db()
        self.assertEqual(self.activity.status, 'cancelled')
        self.assertFalse(Participation.objects.filter(status__in=['pending', 'approved']).exists())

    def test_attendance_racing_cancellation_is_either_rejected_or_preserved_as_cancelled_history(self):
        entry = services.register(self.activity.pk, self.one)
        services.review(self.activity.pk, entry.pk, self.owner, 'approved')
        Activity.objects.filter(pk=self.activity.pk).update(starts_at=timezone.now() - timedelta(minutes=1))
        def attend():
            services.confirm_attendance(self.activity.pk, entry.pk, self.owner)
            return 201
        results = self.parallel([attend, lambda: self.organizer_request('post', self.base + 'status/', {'status': 'cancelled'})])
        self.assertEqual(results[1], 200)
        self.assertIn(results[0], [201, 400])
        entry.refresh_from_db()
        self.assertEqual(entry.status, 'cancelled')
        metrics = metrics_for(self.one)
        self.assertEqual(metrics['attended_completed'], 0)
        self.assertEqual(metrics['attended_cancelled'], Attendance.objects.count())

    def test_approval_racing_capacity_reduction_cannot_overbook(self):
        Activity.objects.filter(pk=self.activity.pk).update(capacity=2)
        one = services.register(self.activity.pk, self.one)
        two = services.register(self.activity.pk, self.two)
        services.review(self.activity.pk, one.pk, self.owner, 'approved')
        def approve():
            services.review(self.activity.pk, two.pk, self.owner, 'approved')
            return 200
        results = self.parallel([approve, lambda: self.organizer_request('patch', self.base, {'capacity': 1})])
        self.assertCountEqual(results, [200, 400])
        self.activity.refresh_from_db()
        self.assertLessEqual(Participation.objects.filter(status='approved').count(), self.activity.capacity)

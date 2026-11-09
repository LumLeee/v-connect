from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.activities.models import Activity
from ..models import Invitation


class ManagedInvitationFilterTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user('invite.filters.owner@example.invalid', full_name='Owner', role='organizer')
        self.other = User.objects.create_user('invite.filters.other@example.invalid', full_name='Other', role='organizer')
        self.now = timezone.now()
        self.activity = self.make_activity(self.owner)
        self.items = [self.make_invitation(status, f'Candidate {status}') for status in Invitation.Status.values]
        self.base = f'/api/v1/organizer/activities/{self.activity.pk}/invitations/'
        self.client.force_login(self.owner)

    def make_activity(self, owner):
        return Activity.objects.create(organizer=owner, title='Invitations', description='Details', address='Da Nang',
            starts_at=self.now + timedelta(days=2), ends_at=self.now + timedelta(days=2, hours=2),
            capacity=20, status='published', published_at=self.now)

    def make_invitation(self, status, name, activity=None):
        activity = activity or self.activity
        volunteer = User.objects.create_user(f'invite.filters.{Invitation.objects.count()}@example.invalid', full_name=name)
        return Invitation.objects.create(activity=activity, volunteer=volunteer, sent_by=activity.organizer,
            message='Welcome', status=status, created_at=self.now,
            responded_at=None if status == 'pending' else self.now,
            invited_starts_at=activity.starts_at, invited_ends_at=activity.ends_at, invited_address=activity.address)

    def get_data(self, **query):
        response = self.client.get(self.base, query)
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_summary_spans_status_and_pagination_with_stable_order(self):
        expected = {'total': 4, 'pending': 1, 'accepted': 1, 'declined': 1, 'withdrawn': 1}
        first = self.get_data(page_size=2)
        second = self.get_data(page_size=2, page=2)
        self.assertEqual(first['summary'], expected)
        self.assertEqual(second['summary'], expected)
        self.assertEqual(first['count'], 4)
        self.assertIsNotNone(first['next'])
        self.assertIsNone(first['previous'])
        self.assertIsNotNone(second['previous'])
        self.assertIsNone(second['next'])
        self.assertEqual([item['id'] for item in first['results'] + second['results']],
                         sorted([str(item.pk) for item in self.items], reverse=True))
        for status in Invitation.Status.values:
            with self.subTest(status=status):
                data = self.get_data(status=status, page_size=1)
                self.assertEqual(data['count'], 1)
                self.assertEqual(data['results'][0]['status'], status)
                self.assertEqual(data['summary'], expected)

    def test_trimmed_name_search_precedes_status_and_does_not_search_email(self):
        self.make_invitation('pending', 'Candidate accepted second')
        data = self.get_data(search='  ACCEPTED  ', status='pending', page_size=1)
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['results'][0]['volunteer_name'], 'Candidate accepted second')
        self.assertEqual(data['summary'], {'total': 2, 'pending': 1, 'accepted': 1, 'declined': 0, 'withdrawn': 0})
        self.assertEqual(self.get_data(search=self.items[0].volunteer.email)['count'], 0)
        self.assertEqual(self.get_data(search='No matching name')['summary'],
                         {'total': 0, 'pending': 0, 'accepted': 0, 'declined': 0, 'withdrawn': 0})
        self.assertEqual(self.get_data(search='   ', status=' all ')['count'], 5)

    def test_scope_is_activity_and_owner_and_recipient_email_remains_private(self):
        self.make_invitation('pending', 'Candidate elsewhere', self.make_activity(self.owner))
        self.make_invitation('accepted', 'Candidate foreign', self.make_activity(self.other))
        data = self.get_data()
        self.assertEqual(data['summary']['total'], 4)
        self.assertFalse(any('email' in row for row in data['results']))
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(self.base).status_code, 404)
        self.client.force_login(self.items[0].volunteer)
        self.assertEqual(self.client.get(self.base).status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.get(self.base).status_code, 401)

    def test_invalid_filters_and_page_are_rejected(self):
        for query, code in [({'status': 'unknown'}, 400), ({'status': ''}, 400),
                            ({'search': 'a' * 201}, 400), ({'page': 999}, 404)]:
            with self.subTest(query=query):
                self.assertEqual(self.client.get(self.base, query).status_code, code)
        self.assertEqual(self.get_data(search=' ' + 'a' * 200 + ' ')['count'], 0)

    def test_volunteer_list_validates_filters_and_keeps_recipient_scope(self):
        volunteer = self.items[0].volunteer
        self.client.force_login(volunteer)
        response = self.client.get('/api/v1/invitations/', {'status': 'invalid', 'search': 'x' * 201})
        self.assertEqual(response.status_code, 400, response.data)
        response = self.client.get('/api/v1/invitations/')
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['id'], str(self.items[0].pk))
        self.assertEqual(response.data['summary'], {'total': 1, 'pending': 1, 'accepted': 0, 'declined': 0, 'withdrawn': 0})


class VolunteerInvitationFilterTests(APITestCase):
    url = '/api/v1/invitations/'

    def setUp(self):
        cache.clear()
        self.now = timezone.now()
        self.owner = User.objects.create_user('my.invites.owner@example.invalid', full_name='Community kitchen', role='organizer')
        self.one = User.objects.create_user('my.invites.one@example.invalid', full_name='Volunteer one')
        self.two = User.objects.create_user('my.invites.two@example.invalid', full_name='Volunteer two')
        self.client.force_login(self.one)

    def invitation(self, status='pending', title='Beach cleanup', volunteer=None, owner=None):
        owner = owner or self.owner
        activity = Activity.objects.create(
            organizer=owner, title=title, description='Details', address='Da Nang', capacity=10,
            starts_at=self.now + timedelta(days=1), ends_at=self.now + timedelta(days=1, hours=1),
            status='published', published_at=self.now,
        )
        return Invitation.objects.create(
            activity=activity, volunteer=volunteer or self.one, sent_by=owner, status=status,
            created_at=self.now, responded_at=None if status == 'pending' else self.now,
            invited_starts_at=activity.starts_at, invited_ends_at=activity.ends_at, invited_address=activity.address,
        )

    def test_search_summary_status_and_page_are_scoped_to_recipient(self):
        items = [self.invitation(status) for status in ['pending', 'pending', 'accepted', 'declined', 'withdrawn']]
        self.invitation(title='Tree planting')
        self.invitation(volunteer=self.two)
        expected = {'total': 5, 'pending': 2, 'accepted': 1, 'declined': 1, 'withdrawn': 1}
        first = self.client.get(self.url, {'search': '  BEACH  ', 'status': ' pending ', 'page_size': 1})
        second = self.client.get(self.url, {'search': 'beach', 'status': 'pending', 'page_size': 1, 'page': 2})
        for response in [first, second]:
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data['count'], 2)
            self.assertEqual(response.data['summary'], expected)
            self.assertIn('no-store', response['Cache-Control'])
        self.assertCountEqual([first.data['results'][0]['id'], second.data['results'][0]['id']],
                              [str(item.pk) for item in items[:2]])
        self.assertIsNotNone(first.data['next'])
        for status in ['accepted', 'declined', 'withdrawn']:
            response = self.client.get(self.url, {'search': 'beach', 'status': status})
            self.assertEqual(response.data['count'], 1)
            self.assertEqual(response.data['summary'], expected)
            self.assertEqual(response.data['results'][0]['status'], status)

    def test_search_matches_organizer_name_and_title_without_private_email(self):
        self.invitation(title='Beach cleanup')
        self.invitation(status='accepted', title='Tree planting')
        other = User.objects.create_user('my.invites.other@example.invalid', full_name='Other organizer', role='organizer')
        self.invitation(owner=other, title='Beach cleanup')
        response = self.client.get(self.url, {'search': '  KITCHEN ', 'status': 'accepted'})
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['summary'], {'total': 2, 'pending': 1, 'accepted': 1, 'declined': 0, 'withdrawn': 0})
        self.assertEqual(self.client.get(self.url, {'search': self.owner.email}).data['count'], 0)
        self.assertEqual(self.client.get(self.url, {'search': 'No match'}).data['summary'],
                         {'total': 0, 'pending': 0, 'accepted': 0, 'declined': 0, 'withdrawn': 0})

    def test_unavailable_pending_invitation_retains_status_and_explanation(self):
        item = self.invitation()
        item.activity.status = 'cancelled'
        item.activity.save(update_fields=['status'])
        response = self.client.get(self.url, {'status': 'pending'})
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['summary']['pending'], 1)
        self.assertEqual(response.data['results'][0]['status'], 'pending')
        self.assertEqual(response.data['results'][0]['unavailable_reason'], 'Hoạt động không còn mở đăng ký.')

    def test_invalid_filters_and_out_of_range_page_are_rejected(self):
        self.invitation()
        for query, status in [({'status': ''}, 400), ({'status': 'unknown'}, 400),
                              ({'search': 'x' * 201}, 400), ({'page': 999}, 404)]:
            self.assertEqual(self.client.get(self.url, query).status_code, status)
        self.assertEqual(self.client.get(self.url, {'status': ' all ', 'search': '   '}).data['count'], 1)
        self.assertEqual(self.client.get(self.url, {'search': ' ' + 'x' * 200 + ' '}).status_code, 200)

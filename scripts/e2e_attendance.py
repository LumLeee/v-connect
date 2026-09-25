"""Fixtures for time-dependent browser tests, restricted to the runner's test DB."""
import json
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import connection
from django.utils import timezone

from apps.accounts.models import User
from apps.activities.models import Activity
from apps.participations.models import Participation


def seed_attendance(env, database, original_database):
    if (not database.startswith('test_') or database == original_database
            or connection.settings_dict['NAME'] != database
            or settings.DATABASES['default']['NAME'] != database):
        raise RuntimeError('Attendance fixtures require the active disposable test database.')
    password = secrets.token_urlsafe(24)
    owner = User.objects.create_user('attendance.org@example.invalid', password, full_name='Nhà tổ chức điểm danh', role='organizer')
    volunteer = User.objects.create_user('attendance.volunteer@example.invalid', password, full_name='Nguyễn An Điểm Danh')
    pending = User.objects.create_user('attendance.pending@example.invalid', password, full_name='Người chưa được duyệt')
    fixtures = {}
    now = timezone.now()
    for project in ['desktop', 'narrow']:
        fixtures[project] = {}
        for state, start, end in [('ongoing', -1, 2), ('upcoming', 24, 26), ('ended', -3, -1)]:
            activity = Activity.objects.create(organizer=owner, title=f'Hoạt động điểm danh {state} {project}',
                description='Dữ liệu chỉ dùng trong database kiểm thử.', address='Huế', capacity=5,
                starts_at=now + timedelta(hours=start), ends_at=now + timedelta(hours=end), status='published', published_at=now - timedelta(days=2))
            entry = Participation.objects.create(activity=activity, volunteer=volunteer, status='approved', reviewed_by=owner, reviewed_at=now - timedelta(days=1),
                registered_starts_at=activity.starts_at, registered_ends_at=activity.ends_at, registered_address=activity.address)
            Participation.objects.create(activity=activity, volunteer=pending,
                registered_starts_at=activity.starts_at, registered_ends_at=activity.ends_at, registered_address=activity.address)
            fixtures[project][state] = {'activity': str(activity.pk), 'entry': str(entry.pk)}
    env.update(E2E_ATTENDANCE_FIXTURES=json.dumps(fixtures), E2E_ATTENDANCE_PASSWORD=password,
               E2E_ATTENDANCE_ORGANIZER=owner.email, E2E_ATTENDANCE_VOLUNTEER=volunteer.email)

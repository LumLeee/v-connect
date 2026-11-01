"""Ranking browser fixtures; never write outside the disposable E2E database."""
import json
from datetime import timedelta

from django.conf import settings
from django.db import connection
from django.utils import timezone

from apps.accounts.models import User
from apps.activities.models import Activity
from apps.participations.models import Attendance, Contribution, Participation


def seed_leaderboard(env, database, original_database):
    if (not database.startswith('test_') or database == original_database
            or connection.settings_dict['NAME'] != database
            or settings.DATABASES['default']['NAME'] != database):
        raise RuntimeError('Leaderboard fixtures require the active disposable test database.')
    owner = User.objects.get(email=env['E2E_ATTENDANCE_ORGANIZER'])
    hashed_password = User.objects.get(email=env['E2E_ATTENDANCE_VOLUNTEER']).password
    now = timezone.now()
    fixtures = {}
    for project in ['desktop', 'narrow']:
        people = [User(email=f'ranking.{project}.{i}@example.invalid', full_name=f'Tình nguyện viên {project} {i:02}',
                       role='volunteer', password=hashed_password) for i in range(24)]
        User.objects.bulk_create(people)
        first = Activity.objects.create(organizer=owner, title=f'Điểm xếp hạng {project}', description='Chỉ dùng kiểm thử',
            address='Huế', starts_at=now-timedelta(days=3), ends_at=now-timedelta(days=2), capacity=100, status='completed')
        second = Activity.objects.create(organizer=owner, title=f'Điểm lên cấp {project}', description='Chỉ dùng kiểm thử',
            address='Huế', starts_at=now-timedelta(days=2), ends_at=now-timedelta(days=1), capacity=100, status='completed')
        selected_attendance = None
        for activity, users in [(first, people), (second, people[:2])]:
            entries = [Participation(activity=activity, volunteer=user, status='approved',
                registered_starts_at=activity.starts_at, registered_ends_at=activity.ends_at,
                registered_address=activity.address) for user in users]
            Participation.objects.bulk_create(entries)
            attendances = [Attendance(participation=entry, confirmed_by=owner) for entry in entries]
            Attendance.objects.bulk_create(attendances)
            Contribution.objects.bulk_create([Contribution(attendance=attendance, score=(10 if i == 0 or activity == second else 9 if i == 1 else 8),
                confirmed_by=owner) for i, attendance in enumerate(attendances)])
            if activity == first:
                selected_attendance = attendances[0]
        fixtures[project] = {'email': people[0].email, 'name': people[0].full_name,
                             'activity': str(first.pk), 'attendance': str(selected_attendance.pk)}
    env['E2E_LEADERBOARD_FIXTURES'] = json.dumps(fixtures)

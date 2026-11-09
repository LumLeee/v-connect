import uuid

from django.contrib.auth.hashers import make_password
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class AdminIdentityMigrationTests(TransactionTestCase):
    def test_existing_admin_gets_username_without_losing_account_fields(self):
        before = [('accounts', '0001_initial')]
        after = [('accounts', '0003_user_username_alter_user_email_and_more')]
        executor = MigrationExecutor(connection)
        latest = executor.loader.graph.leaf_nodes()
        self.addCleanup(lambda: MigrationExecutor(connection).migrate(latest))
        executor.migrate(before)
        OldUser = executor.loader.project_state(before).apps.get_model('accounts', 'User')
        identifier = uuid.uuid4()
        hashed = make_password('Migration-Test-493!')
        OldUser.objects.create(id=identifier, email='legacy.admin@example.invalid', role='admin',
            full_name='Quản trị cũ', password=hashed, is_staff=True, is_superuser=True)
        volunteer = OldUser.objects.create(email='legacy.volunteer@example.invalid', full_name='An', role='volunteer', password=hashed)
        executor = MigrationExecutor(connection)
        executor.migrate(after)
        NewUser = executor.loader.project_state(after).apps.get_model('accounts', 'User')
        user = NewUser.objects.get(pk=identifier)
        self.assertEqual(user.username, 'admin_' + identifier.hex)
        self.assertEqual(user.email, 'legacy.admin@example.invalid')
        self.assertEqual(user.password, hashed)
        self.assertEqual(user.full_name, 'Quản trị cũ')
        self.assertTrue(user.is_staff and user.is_superuser)
        self.assertIsNone(NewUser.objects.get(pk=volunteer.pk).username)

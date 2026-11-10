"""Never reuse an existing schema or enter Django's DROP-and-retry fallback."""
from copy import deepcopy
import secrets

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import DatabaseError
from django.db.backends.mysql.creation import DatabaseCreation as MySQLDatabaseCreation

from config.test_database import validate_test_database_name


class DatabaseCreation(MySQLDatabaseCreation):
    marker_table = 'vconnect_test_owner'

    def __init__(self, connection):
        super().__init__(connection)
        self._owned_name = None
        self._owner_token = None
        self._source_settings = None

    @staticmethod
    def _reject_keepdb(keepdb):
        if keepdb:
            raise ImproperlyConfigured(
                'Project tests require a fresh database; --keepdb is not supported.'
            )

    def create_test_db(self, verbosity=1, autoclobber=False, serialize=True, keepdb=False):
        self._reject_keepdb(keepdb)
        if self._owned_name is not None:
            raise ImproperlyConfigured('This connection already owns a test database.')
        try:
            return super().create_test_db(verbosity, autoclobber, serialize, keepdb)
        except BaseException as error:
            try:
                self.cleanup_failed_setup()
            except Exception as cleanup_error:
                error.add_note(f'Test database cleanup was refused: {cleanup_error}')
            raise

    def _create_test_db(self, verbosity, autoclobber, keepdb=False):
        self._reject_keepdb(keepdb)
        if self._owned_name is not None:
            raise ImproperlyConfigured('This connection already owns a test database.')
        original = deepcopy(self.connection.settings_dict)
        if any(str(key).casefold() in {'database', 'db'} for key in original.get('OPTIONS', {})):
            raise ImproperlyConfigured('Database OPTIONS must not override the selected test database.')
        name = validate_test_database_name(self._get_test_db_name(), original['NAME'])
        quoted_name = self.connection.ops.quote_name(name)
        suffix = self.sql_table_creation_suffix()
        # CREATE is the authoritative collision check, including simultaneous runs.
        # In particular, do not call the parent _create/_execute methods: they can
        # DROP an existing schema or reuse it when --keepdb is passed.
        with self._nodb_cursor() as cursor:
            try:
                cursor.execute(f'CREATE DATABASE {quoted_name} {suffix}')
            except DatabaseError as error:
                code = error.args[0] if error.args and isinstance(error.args[0], int) else 'unknown'
                raise ImproperlyConfigured(
                    f'Cannot create fresh test database {name} (MySQL {code}). '
                    'Existing databases are never reused or deleted.'
                ) from None
            self._source_settings = original
            self._owned_name = name
            self._owner_token = secrets.token_hex(32)
            cursor.execute(
                f'CREATE TABLE {quoted_name}.`{self.marker_table}` '
                '(token CHAR(64) NOT NULL PRIMARY KEY)'
            )
            cursor.execute(
                f'INSERT INTO {quoted_name}.`{self.marker_table}` (token) VALUES (%s)',
                [self._owner_token],
            )
        return name

    def _assert_owned_context(self, allow_original=False):
        if not self._owned_name or not self._source_settings or not self._owner_token:
            raise RuntimeError('Refusing cleanup of a database not created by this connection.')
        validate_test_database_name(self._owned_name, self._source_settings['NAME'])
        allowed_names = {self._owned_name}
        if allow_original:
            allowed_names.add(self._source_settings['NAME'])
        original = {key: value for key, value in self._source_settings.items() if key != 'NAME'}
        for current in (self.connection.settings_dict, settings.DATABASES[self.connection.alias]):
            if current.get('NAME') not in allowed_names:
                raise RuntimeError('Refusing cleanup: active database is not the owned test database.')
            if {key: value for key, value in current.items() if key != 'NAME'} != original:
                raise RuntimeError('Refusing cleanup: database connection configuration changed.')

    def _destroy_test_db(self, test_database_name, verbosity):
        self._assert_owned_context()
        if test_database_name != self._owned_name:
            raise RuntimeError('Refusing cleanup: requested database is not owned by this run.')
        quoted_name = self.connection.ops.quote_name(self._owned_name)
        with self._nodb_cursor() as cursor:
            try:
                cursor.execute(f'SELECT token FROM {quoted_name}.`{self.marker_table}`')
                markers = cursor.fetchall()
            except DatabaseError:
                raise RuntimeError('Refusing cleanup: test database ownership marker is unavailable.') from None
            if markers != ((self._owner_token,),):
                raise RuntimeError('Refusing cleanup: test database ownership marker does not match.')
            cursor.execute(f'DROP DATABASE {quoted_name}')
        self._owned_name = None
        self._owner_token = None
        self._source_settings = None

    def destroy_test_db(self, old_database_name=None, verbosity=1, keepdb=False, suffix=None):
        self._reject_keepdb(keepdb)
        if suffix is not None:
            raise ImproperlyConfigured('Parallel test database clones are not supported.')
        return super().destroy_test_db(old_database_name, verbosity, keepdb, suffix)

    def cleanup_failed_setup(self):
        """Remove only this run's marked schema if migration/setup did not finish."""
        if self._owned_name is None:
            return
        self._assert_owned_context(allow_original=True)
        original_name = self._source_settings['NAME']
        # CREATE may have succeeded before Django switched its active NAME.
        self.connection.close()
        self.connection.settings_dict['NAME'] = self._owned_name
        settings.DATABASES[self.connection.alias]['NAME'] = self._owned_name
        self.destroy_test_db(original_name, verbosity=0)

    def clone_test_db(self, suffix, verbosity=1, autoclobber=False, keepdb=False):
        raise ImproperlyConfigured('Parallel test database clones are not supported.')

    def _clone_test_db(self, suffix, verbosity, keepdb=False):
        raise ImproperlyConfigured('Parallel test database clones are not supported.')

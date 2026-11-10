from django.db.backends.mysql.base import DatabaseWrapper as MySQLDatabaseWrapper

from .creation import DatabaseCreation


class DatabaseWrapper(MySQLDatabaseWrapper):
    creation_class = DatabaseCreation

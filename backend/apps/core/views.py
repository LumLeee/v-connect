import logging

from django.db import DatabaseError, connection
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Skill
from .serializers import SkillSerializer

logger = logging.getLogger("vconnect.health")


class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = []

    def get(self, request):
        database = "unavailable"
        migrations = "unknown"
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            database = "connected"
            executor = MigrationExecutor(connection)
            pending = executor.migration_plan(executor.loader.graph.leaf_nodes())
            migrations = "pending" if pending else "applied"
        except DatabaseError:
            # Do not expose connection strings, database users or server errors.
            logger.warning("Database readiness check failed")
        ready = database == "connected" and migrations == "applied"
        return Response({
            "status": "ok" if ready else "degraded",
            "service": "v-connect-api",
            "database": database,
            "migrations": migrations,
            "timestamp": timezone.now().isoformat(),
        }, status=200 if ready else 503)


class SkillListView(ListAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = SkillSerializer
    queryset = Skill.objects.all()

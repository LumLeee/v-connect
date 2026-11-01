from django.contrib import admin
from apps.activities.models import Activity
from apps.participations.models import Participation, Attendance
from apps.feedback.models import Feedback
from .models import AuditEvent


class ReadOnlyBusinessAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Activity)
class ActivityAdmin(ReadOnlyBusinessAdmin):
    list_display = ['title', 'organizer', 'status', 'starts_at']
    list_filter = ['status']
    search_fields = ['title']


@admin.register(Participation)
class ParticipationAdmin(ReadOnlyBusinessAdmin):
    list_display = ['activity', 'volunteer', 'status', 'reviewed_by', 'reviewed_at']
    list_filter = ['status']


@admin.register(Attendance)
class AttendanceAdmin(ReadOnlyBusinessAdmin):
    list_display = ['participation', 'confirmed_by', 'confirmed_at']


@admin.register(Feedback)
class FeedbackAdmin(ReadOnlyBusinessAdmin):
    list_display = ['attendance', 'rating', 'is_hidden', 'hidden_by', 'hidden_at']
    list_filter = ['is_hidden']


@admin.register(AuditEvent)
class AuditAdmin(ReadOnlyBusinessAdmin):
    list_display = ['action', 'actor', 'subject', 'activity', 'created_at']
    list_filter = ['action']

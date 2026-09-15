from django.urls import path

from .views import HealthView, SkillListView

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("skills/", SkillListView.as_view(), name="skill-list"),
]

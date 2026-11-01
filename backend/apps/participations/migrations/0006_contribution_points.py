from django.db import migrations, models


def clear_hour_records(apps, schema_editor):
    # Explicitly requested reset: minutes must never be interpreted as points.
    # Back up the database before deployment. This deletion is irreversible.
    alias = schema_editor.connection.alias
    apps.get_model('reports', 'Certificate').objects.using(alias).all().delete()
    apps.get_model('participations', 'ContributionChange').objects.using(alias).all().delete()
    apps.get_model('participations', 'Contribution').objects.using(alias).all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ('participations', '0005_invitation'),
        ('reports', '0005_alter_auditevent_action'),
    ]

    operations = [
        migrations.RunPython(clear_hour_records),
        migrations.RenameField('contribution', 'minutes', 'score'),
        migrations.RenameField('contributionchange', 'minutes', 'score'),
        migrations.RenameField('contributionchange', 'previous_minutes', 'previous_score'),
        migrations.AddConstraint('contribution', models.CheckConstraint(condition=models.Q(score__gte=0, score__lte=10), name='contribution_score_range')),
        migrations.AddConstraint('contributionchange', models.CheckConstraint(condition=models.Q(score__gte=0, score__lte=10), name='contribution_change_score_range')),
        migrations.AddConstraint('contributionchange', models.CheckConstraint(condition=models.Q(previous_score__isnull=True) | models.Q(previous_score__gte=0, previous_score__lte=10), name='contribution_previous_score_range')),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('reports', '0005_alter_auditevent_action'),
        ('participations', '0006_contribution_points'),
    ]

    operations = [
        migrations.RemoveConstraint('certificate', 'certificate_positive_minutes'),
        migrations.RenameField('certificate', 'minutes', 'score'),
        migrations.AddConstraint('certificate', models.CheckConstraint(condition=models.Q(score__gte=1, score__lte=10), name='certificate_score_range')),
    ]

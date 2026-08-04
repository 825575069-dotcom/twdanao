"""Add credits field to Tenant"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('platform', '0008_agentrole_agent_agent_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenant',
            name='credits',
            field=models.IntegerField(default=0, verbose_name='积分余额'),
        ),
    ]

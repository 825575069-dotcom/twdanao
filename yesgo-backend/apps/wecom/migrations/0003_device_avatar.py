"""
添加 WecomDevice.avatar 字段
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wecom', '0002_contact_pinned'),
    ]

    operations = [
        migrations.AddField(
            model_name='wecomdevice',
            name='avatar',
            field=models.URLField(blank=True, default='', verbose_name='头像URL'),
        ),
    ]

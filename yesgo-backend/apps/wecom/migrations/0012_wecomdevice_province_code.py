"""
添加 WecomDevice.province_code 字段（设备归属省代码）
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wecom', '0011_alter_wecomtag_options_wecomcontact_tags_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='wecomdevice',
            name='province_code',
            field=models.CharField(blank=True, default='', max_length=10, verbose_name='设备归属省代码'),
        ),
    ]

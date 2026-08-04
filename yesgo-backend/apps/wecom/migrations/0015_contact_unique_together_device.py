"""
Change WecomContact.external_userid from globally unique to (external_userid, device) unique together.
This allows the same external user to exist as separate contact records for different devices.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wecom', '0014_alter_wecomdevice_qiwe_token_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='wecomcontact',
            name='external_userid',
            field=models.CharField(max_length=200, verbose_name='企微外部联系人ID'),
        ),
        migrations.AlterUniqueTogether(
            name='wecomcontact',
            unique_together={('external_userid', 'device')},
        ),
    ]

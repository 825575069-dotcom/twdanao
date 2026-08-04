"""Add is_pinned and pinned_at to WecomContact"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wecom', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='wecomcontact',
            name='is_pinned',
            field=models.BooleanField(default=False, verbose_name='是否置顶'),
        ),
        migrations.AddField(
            model_name='wecomcontact',
            name='pinned_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='置顶时间'),
        ),
        migrations.AlterModelOptions(
            name='wecomcontact',
            options={'ordering': ['-is_pinned', '-pinned_at', '-updated_at'], 'verbose_name': '企微联系人', 'verbose_name_plural': '企微联系人'},
        ),
    ]

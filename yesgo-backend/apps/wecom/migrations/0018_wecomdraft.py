"""
Migration 0018: WecomDraft model — 聊天草稿后端持久化
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('platform', '0001_initial'),
        ('wecom', '0017_wecomcontact_source_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='WecomDraft',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('conversation_type', models.CharField(
                    choices=[('personal', '个人'), ('group', '群聊')],
                    default='personal', max_length=20, verbose_name='会话类型')),
                ('conversation_id', models.IntegerField(verbose_name='会话ID（contact_id 或 room_id）')),
                ('content', models.TextField(blank=True, default='', verbose_name='草稿文本内容')),
                ('media_url', models.URLField(blank=True, default='', verbose_name='媒体URL')),
                ('media_type', models.CharField(blank=True, default='', max_length=20, verbose_name='媒体类型')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('tenant', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='wecom_drafts', to='platform.tenant', verbose_name='所属租户')),
                ('device', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='drafts', to='wecom.wecomdevice', verbose_name='所属设备')),
            ],
            options={
                'db_table': 'wecom_draft',
                'verbose_name': '企微草稿',
                'verbose_name_plural': '企微草稿',
                'ordering': ['-updated_at'],
                'unique_together': {('tenant', 'device', 'conversation_type', 'conversation_id')},
            },
        ),
    ]

"""
Migration 0019: WecomMessage — 消息状态 + 客户端消息ID（乐观更新）
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wecom', '0018_wecomdraft'),
    ]

    operations = [
        migrations.AddField(
            model_name='wecommessage',
            name='client_msg_id',
            field=models.UUIDField(db_index=True, blank=True, null=True, verbose_name='客户端消息ID（乐观更新）'),
        ),
        migrations.AddField(
            model_name='wecommessage',
            name='status',
            field=models.CharField(
                choices=[
                    ('sending', '发送中'),
                    ('sent', '已发送'),
                    ('delivered', '已送达'),
                    ('read', '已读'),
                    ('failed', '发送失败'),
                ],
                default='sent', max_length=20, verbose_name='消息状态'),
        ),
    ]

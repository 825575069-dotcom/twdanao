# Generated for 提示词(Prompt) 功能
# 注意：Role.permissions / Tenant.created_by 已在生产库通过早期迁移/手动 ALTER 存在，
# 此处不再 AddField，避免 migrate 时 "duplicate column" 报错。

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('platform', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Prompt',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('prompt_type', models.CharField(choices=[('home', '首页提示词'), ('chat', '普通提示词')], max_length=10, verbose_name='类型')),
                ('category', models.CharField(blank=True, choices=[('recommend', '推荐'), ('platform', '平台运营'), ('marketing', '营销跟客'), ('flow', '流向管控'), ('purchase', '智能采购'), ('academic', '学术培训')], default='recommend', max_length=20, verbose_name='分类（仅首页提示词使用）')),
                ('title', models.CharField(blank=True, default='', max_length=100, verbose_name='标题')),
                ('icon', models.CharField(blank=True, default='', max_length=50, verbose_name='图标（前端图标注册表 key，仅首页提示词使用）')),
                ('content', models.TextField(verbose_name='提示词内容')),
                ('enabled', models.BooleanField(default=True, verbose_name='是否启用')),
                ('sort', models.IntegerField(default=0, verbose_name='排序')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
            ],
            options={
                'verbose_name': '提示词',
                'verbose_name_plural': '提示词',
                'db_table': 'platform_prompt',
                'ordering': ['sort', 'id'],
            },
        ),
    ]

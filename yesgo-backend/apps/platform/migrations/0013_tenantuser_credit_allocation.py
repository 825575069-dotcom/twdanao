"""
TenantUser 新增积分分配类型与值字段
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('platform', '0012_agent_avatar'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenantuser',
            name='credit_allocation_type',
            field=models.CharField(
                choices=[
                    ('unlimited', '无限'),
                    ('monthly', '月用量'),
                    ('daily', '日用量'),
                    ('fixed', '固定量'),
                ],
                default='fixed',
                max_length=20,
                verbose_name='积分分配类型',
            ),
        ),
        migrations.AddField(
            model_name='tenantuser',
            name='credit_allocation_value',
            field=models.IntegerField(blank=True, default=0, verbose_name='积分分配值'),
        ),
    ]

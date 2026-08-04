"""添加首营记录外部复用字段

- external_reused: 是否外部复用（供应商API确认已有首营资料时自动复用）
- external_source: 外部复用来源（供应商API地址或名称）
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('public_database', '0011_tenant_qualification_first_operation'),
    ]

    operations = [
        migrations.AddField(
            model_name='firstoperationrecord',
            name='external_reused',
            field=models.BooleanField(default=False, verbose_name='是否外部复用'),
        ),
        migrations.AddField(
            model_name='firstoperationrecord',
            name='external_source',
            field=models.CharField(blank=True, default='', help_text='记录复用来源，如供应商API地址', max_length=200, verbose_name='外部复用来源'),
        ),
        migrations.AddIndex(
            model_name='firstoperationrecord',
            index=models.Index(fields=['external_reused'], name='pdb_first_extern_idx'),
        ),
    ]

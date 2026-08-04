"""添加报价备注字段和供应商拒绝报价状态"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('public_database', '0004_suppliernotification'),
    ]

    operations = [
        migrations.AddField(
            model_name='collectiveparticipation',
            name='quote_notes',
            field=models.TextField(blank=True, default='', verbose_name='报价备注'),
        ),
        migrations.AlterField(
            model_name='collectiveparticipation',
            name='status',
            field=models.CharField(
                choices=[
                    ('registered', '已登记'),
                    ('quoted', '已收到报价'),
                    ('ordered', '已下单'),
                    ('declined', '已放弃'),
                    ('supplier_declined', '供应商拒绝报价'),
                ],
                default='registered',
                max_length=20,
                verbose_name='状态',
            ),
        ),
    ]

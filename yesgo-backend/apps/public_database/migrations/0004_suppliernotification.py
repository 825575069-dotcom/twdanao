"""Create SupplierNotification model"""
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('public_database', '0003_publicproduct_image_url_procurementorder_tracking_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='SupplierNotification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('notification_type', models.CharField(
                    choices=[
                        ('order_new', '新订单'),
                        ('order_status', '订单状态变更'),
                        ('order_paid', '订单已支付'),
                        ('order_completed', '订单已完成'),
                        ('return_requested', '退货申请'),
                        ('return_processed', '退货处理结果'),
                        ('collective_announcement', '集采公告'),
                        ('collective_quote_request', '集采报价请求'),
                        ('qualification_expiring', '资质即将到期'),
                        ('qualification_expired', '资质已过期'),
                        ('low_stock', '库存不足'),
                        ('payment_received', '收款到账'),
                        ('system', '系统通知'),
                    ],
                    max_length=30, verbose_name='通知类型')),
                ('title', models.CharField(max_length=200, verbose_name='通知标题')),
                ('content', models.TextField(verbose_name='通知内容')),
                ('is_read', models.BooleanField(default=False, verbose_name='是否已读')),
                ('related_type', models.CharField(blank=True, default='', max_length=50, verbose_name='关联资源类型')),
                ('related_id', models.IntegerField(blank=True, null=True, verbose_name='关联资源ID')),
                ('extra_data', models.JSONField(blank=True, default=dict, verbose_name='额外数据')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('read_at', models.DateTimeField(blank=True, null=True, verbose_name='阅读时间')),
                ('supplier', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='notifications',
                    to='public_database.supplier',
                    verbose_name='供应商')),
            ],
            options={
                'verbose_name': '供应商通知',
                'verbose_name_plural': '供应商通知',
                'db_table': 'pdb_supplier_notification',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='suppliernotification',
            index=models.Index(fields=['supplier', 'is_read'], name='pdb_sn_supplier_read_idx'),
        ),
        migrations.AddIndex(
            model_name='suppliernotification',
            index=models.Index(fields=['supplier', 'created_at'], name='pdb_sn_supplier_created_idx'),
        ),
    ]

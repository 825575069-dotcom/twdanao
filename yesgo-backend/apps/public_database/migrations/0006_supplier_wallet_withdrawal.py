"""
供应商钱包 + 提现记录
"""
from django.db import migrations, models
import django.db.models.deletion
import decimal


def create_wallets_for_existing_suppliers(apps, schema_editor):
    """为所有已有供应商创建钱包记录"""
    Supplier = apps.get_model('public_database', 'Supplier')
    SupplierWallet = apps.get_model('public_database', 'SupplierWallet')
    for supplier in Supplier.objects.all():
        SupplierWallet.objects.get_or_create(supplier=supplier)


def remove_wallets(apps, schema_editor):
    SupplierWallet = apps.get_model('public_database', 'SupplierWallet')
    SupplierWallet.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('public_database', '0005_collectiveparticipation_quote_notes'),
    ]

    operations = [
        # 1. 更新 SupplierNotification 的 choices（不涉及表结构变更，仅 choice 更新）
        migrations.AlterField(
            model_name='suppliernotification',
            name='notification_type',
            field=models.CharField(
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
                    ('withdrawal_created', '提现申请已提交'),
                    ('withdrawal_completed', '提现已到账'),
                    ('withdrawal_rejected', '提现申请被拒绝'),
                    ('system', '系统通知'),
                ],
                max_length=30,
                verbose_name='通知类型',
            ),
        ),
        # 2. 创建 SupplierWallet
        migrations.CreateModel(
            name='SupplierWallet',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('bank_name', models.CharField(blank=True, default='', max_length=100, verbose_name='开户银行')),
                ('bank_account', models.CharField(blank=True, default='', max_length=100, verbose_name='银行账号')),
                ('bank_holder', models.CharField(blank=True, default='', max_length=100, verbose_name='账户持有人')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('supplier', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='wallet', to='public_database.supplier', verbose_name='供应商'
                )),
            ],
            options={
                'verbose_name': '供应商钱包',
                'verbose_name_plural': '供应商钱包',
                'db_table': 'pdb_supplier_wallet',
            },
        ),
        # 3. 创建 WithdrawalRecord
        migrations.CreateModel(
            name='WithdrawalRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('withdrawal_number', models.CharField(max_length=50, unique=True, verbose_name='提现编号')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=14, verbose_name='提现金额')),
                ('fee', models.DecimalField(decimal_places=2, default=decimal.Decimal('0'), max_digits=10, verbose_name='手续费')),
                ('bank_name', models.CharField(max_length=100, verbose_name='开户银行')),
                ('bank_account', models.CharField(max_length=100, verbose_name='银行账号')),
                ('bank_holder', models.CharField(max_length=100, verbose_name='账户持有人')),
                ('remark', models.TextField(blank=True, default='', verbose_name='备注')),
                ('status', models.CharField(
                    choices=[
                        ('pending', '待审核'),
                        ('processing', '处理中'),
                        ('completed', '已完成'),
                        ('rejected', '已拒绝'),
                        ('cancelled', '已取消'),
                    ],
                    default='pending', max_length=20, verbose_name='状态'
                )),
                ('admin_remark', models.TextField(blank=True, default='', verbose_name='管理员备注')),
                ('processed_at', models.DateTimeField(blank=True, null=True, verbose_name='处理时间')),
                ('completed_at', models.DateTimeField(blank=True, null=True, verbose_name='完成时间')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('supplier', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='withdrawals', to='public_database.supplier', verbose_name='供应商'
                )),
                ('wallet', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='withdrawals', to='public_database.supplierwallet', verbose_name='钱包'
                )),
            ],
            options={
                'verbose_name': '提现记录',
                'verbose_name_plural': '提现记录',
                'db_table': 'pdb_withdrawal_record',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['supplier', 'status'], name='pdb_withdr_suppli_status_idx'),
                    models.Index(fields=['created_at'], name='pdb_withdr_created_idx'),
                ],
            },
        ),
        # 4. 为已有供应商创建钱包
        migrations.RunPython(create_wallets_for_existing_suppliers, remove_wallets),
    ]

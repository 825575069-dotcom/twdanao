# Generated manually on 2026-07-29

from django.db import migrations, models
from decimal import Decimal


def migrate_city_to_list(apps, schema_editor):
    SupplierDeliveryRule = apps.get_model('public_database', 'SupplierDeliveryRule')
    for rule in SupplierDeliveryRule.objects.all():
        old_city = rule.city_old or ''
        if isinstance(old_city, list):
            rule.city = old_city
        else:
            rule.city = [old_city.strip()] if old_city.strip() else []
        rule.save(update_fields=['city'])


def merge_duplicate_rules(apps, schema_editor):
    """同一 supplier + province 只能保留一条规则：城市取并集，时效/起订取最宽松。"""
    SupplierDeliveryRule = apps.get_model('public_database', 'SupplierDeliveryRule')
    from collections import defaultdict
    groups = defaultdict(list)
    for rule in SupplierDeliveryRule.objects.all():
        key = (rule.supplier_id, rule.province)
        groups[key].append(rule)

    for (supplier_id, province), rules in groups.items():
        if len(rules) <= 1:
            continue
        # 保留启用状态，城市并集，delivery_hours 最小，min_order_amount 最小
        cities = set()
        min_hours = None
        min_amount = None
        enabled = any(r.enabled for r in rules)
        for r in rules:
            for c in (r.city or []):
                if c:
                    cities.add(c)
            if min_hours is None or r.delivery_hours < min_hours:
                min_hours = r.delivery_hours
            if min_amount is None or r.min_order_amount < min_amount:
                min_amount = r.min_order_amount

        keep = rules[0]
        keep.city = sorted(cities) if cities else []
        keep.delivery_hours = min_hours or 48
        keep.min_order_amount = min_amount if min_amount is not None else Decimal('0')
        keep.enabled = enabled
        keep.save(update_fields=['city', 'delivery_hours', 'min_order_amount', 'enabled'])
        for r in rules[1:]:
            r.delete()


class Migration(migrations.Migration):

    dependencies = [
        ('public_database', '0009_supplierwallet_bank_verify_code_and_more'),
    ]

    operations = [
        # 解除旧唯一约束（包含 city 字符串字段）
        migrations.AlterUniqueTogether(
            name='supplierdeliveryrule',
            unique_together=set(),
        ),
        # 新增 JSON 城市字段，保留原字段用于数据迁移
        migrations.AddField(
            model_name='supplierdeliveryrule',
            name='city_old',
            field=models.CharField(max_length=50, blank=True, default='', verbose_name='城市（旧）'),
        ),
        migrations.RunSQL(
            sql="UPDATE pdb_supplier_delivery_rule SET city_old = city;",
            reverse_sql="UPDATE pdb_supplier_delivery_rule SET city = city_old;",
        ),
        migrations.RemoveField(
            model_name='supplierdeliveryrule',
            name='city',
        ),
        migrations.AddField(
            model_name='supplierdeliveryrule',
            name='city',
            field=models.JSONField(default=list, help_text='配送城市列表，如["广州","深圳"];空列表表示该省全部城市', verbose_name='城市列表（空=全省）'),
        ),
        migrations.RunPython(migrate_city_to_list, reverse_code=migrations.RunPython.noop),
        migrations.RunPython(merge_duplicate_rules, reverse_code=migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='supplierdeliveryrule',
            name='city_old',
        ),
        # 设置新的唯一约束与排序
        migrations.AlterUniqueTogether(
            name='supplierdeliveryrule',
            unique_together={('supplier', 'province')},
        ),
        migrations.AlterModelOptions(
            name='supplierdeliveryrule',
            options={'ordering': ['supplier', 'province'], 'verbose_name': '供应商配送规则', 'verbose_name_plural': '供应商配送规则'},
        ),
    ]

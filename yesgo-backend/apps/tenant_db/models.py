"""数据底座 App — 商品/订单/客户/库存"""

from django.db import models


class Product(models.Model):
    """商品"""
    tenant = models.ForeignKey('platform.Tenant', on_delete=models.CASCADE, related_name='products', verbose_name='所属租户')
    name = models.CharField(max_length=200, verbose_name='商品名称')
    spec = models.CharField(max_length=100, blank=True, default='', verbose_name='规格')
    unit = models.CharField(max_length=20, default='盒', verbose_name='单位')
    category = models.CharField(max_length=100, verbose_name='品类')
    price = models.DecimalField(max_digits=12, decimal_places=2, verbose_name='单价')
    stock = models.IntegerField(default=0, verbose_name='库存数量')
    status = models.CharField(
        max_length=20, default='正常',
        choices=[('正常', '正常'), ('库存预警', '库存预警'), ('已下架', '已下架')],
        verbose_name='状态'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'tenant_product'
        verbose_name = '商品'
        verbose_name_plural = '商品'

    def __str__(self):
        return f'{self.name} ({self.spec})'


class Customer(models.Model):
    """客户"""
    tenant = models.ForeignKey('platform.Tenant', on_delete=models.CASCADE, related_name='customers', verbose_name='所属租户')
    name = models.CharField(max_length=200, verbose_name='客户名称')
    type = models.CharField(
        max_length=20,
        choices=[('连锁药店', '连锁药店'), ('单体药店', '单体药店'), ('诊所', '诊所'), ('医院', '医院')],
        verbose_name='客户类型'
    )
    contact = models.CharField(max_length=100, verbose_name='联系人')
    phone = models.CharField(max_length=20, verbose_name='联系电话')
    monthly_purchase = models.DecimalField(max_digits=14, decimal_places=2, default=0, verbose_name='月采购额')
    last_order = models.DateTimeField(null=True, blank=True, verbose_name='最后下单时间')
    level = models.CharField(
        max_length=10, default='B',
        choices=[('A', 'A级'), ('B', 'B级'), ('C', 'C级')],
        verbose_name='客户等级'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'tenant_customer'
        verbose_name = '客户'
        verbose_name_plural = '客户'

    def __str__(self):
        return f'{self.name} ({self.type})'


class Order(models.Model):
    """订单"""
    tenant = models.ForeignKey('platform.Tenant', on_delete=models.CASCADE, related_name='orders', verbose_name='所属租户')
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, related_name='orders', verbose_name='客户')
    customer_name = models.CharField(max_length=200, verbose_name='客户名称')
    amount = models.DecimalField(max_digits=14, decimal_places=2, verbose_name='订单金额')
    items_count = models.IntegerField(default=1, verbose_name='商品数量')
    status = models.CharField(
        max_length=20, default='待发货',
        choices=[('已完成', '已完成'), ('配送中', '配送中'), ('待发货', '待发货'), ('已取消', '已取消')],
        verbose_name='状态'
    )
    time = models.DateTimeField(verbose_name='下单时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'tenant_order'
        verbose_name = '订单'
        verbose_name_plural = '订单'

    def __str__(self):
        return f'订单#{self.id} {self.customer_name}'


class Warehouse(models.Model):
    """仓库"""
    tenant = models.ForeignKey('platform.Tenant', on_delete=models.CASCADE, related_name='warehouses', verbose_name='所属租户')
    name = models.CharField(max_length=200, verbose_name='仓库名称')
    location = models.CharField(max_length=200, verbose_name='仓库位置')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'tenant_warehouse'
        verbose_name = '仓库'
        verbose_name_plural = '仓库'

    def __str__(self):
        return f'{self.name}({self.location})'


class InventoryAlert(models.Model):
    """库存预警"""
    tenant = models.ForeignKey('platform.Tenant', on_delete=models.CASCADE, related_name='inventory_alerts', verbose_name='所属租户')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='alerts', verbose_name='商品')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='alerts', verbose_name='仓库')
    current = models.IntegerField(verbose_name='当前库存')
    safety = models.IntegerField(verbose_name='安全库存')
    severity = models.CharField(
        max_length=10, default='中',
        choices=[('高', '高'), ('中', '中'), ('低', '低')],
        verbose_name='严重程度'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'tenant_inventory_alert'
        verbose_name = '库存预警'
        verbose_name_plural = '库存预警'

    def __str__(self):
        return f'{self.product.name} @ {self.warehouse.name}'

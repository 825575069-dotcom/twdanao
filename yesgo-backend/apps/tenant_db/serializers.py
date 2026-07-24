"""数据底座序列化器"""

from rest_framework import serializers
from .models import Product, Customer, Order, Warehouse, InventoryAlert


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'name', 'spec', 'unit', 'category', 'price', 'stock', 'status', 'created_at']
        read_only_fields = ['id', 'created_at']


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'name', 'type', 'contact', 'phone', 'monthly_purchase',
                  'last_order', 'level', 'created_at']
        read_only_fields = ['id', 'created_at']


class OrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ['id', 'customer_id', 'customer_name', 'amount', 'items_count',
                  'status', 'time', 'created_at']
        read_only_fields = ['id', 'created_at']


class WarehouseSerializer(serializers.ModelSerializer):
    sku_count = serializers.SerializerMethodField()
    total_value = serializers.SerializerMethodField()
    alert_count = serializers.SerializerMethodField()

    class Meta:
        model = Warehouse
        fields = ['id', 'name', 'location', 'sku_count', 'total_value', 'alert_count']

    def get_sku_count(self, obj):
        return Product.objects.filter(tenant=obj.tenant).count()

    def get_total_value(self, obj):
        products = Product.objects.filter(tenant=obj.tenant)
        total = sum(p.price * p.stock for p in products)
        return float(total)

    def get_alert_count(self, obj):
        return obj.alerts.count()


class InventoryAlertSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)

    class Meta:
        model = InventoryAlert
        fields = ['id', 'product', 'product_name', 'warehouse', 'warehouse_name',
                  'current', 'safety', 'severity', 'created_at']

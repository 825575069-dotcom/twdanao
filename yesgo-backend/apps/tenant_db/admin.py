"""数据底座 Admin"""
from django.contrib import admin
from .models import Product, Customer, Order, Warehouse, InventoryAlert


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'spec', 'category', 'price', 'stock', 'status', 'tenant')
    list_filter = ('tenant', 'category', 'status')
    search_fields = ('name',)


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'type', 'phone', 'level', 'monthly_purchase', 'tenant')
    list_filter = ('tenant', 'type', 'level')
    search_fields = ('name', 'phone')


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer_name', 'amount', 'items_count', 'status', 'time', 'tenant')
    list_filter = ('tenant', 'status')
    search_fields = ('customer_name',)


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'location', 'tenant')
    list_filter = ('tenant',)


@admin.register(InventoryAlert)
class InventoryAlertAdmin(admin.ModelAdmin):
    list_display = ('id', 'product', 'warehouse', 'current', 'safety', 'severity', 'tenant')
    list_filter = ('tenant', 'severity')

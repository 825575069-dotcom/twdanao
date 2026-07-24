"""商户数据接入路由（第一层预留）"""
from django.urls import path
from . import views

urlpatterns = [
    path('tenants/', views.tenants_list),
    path('products/sync/', views.sync_products),
    path('inventory/sync/', views.sync_inventory),
    path('orders/sync/', views.sync_orders),
    path('customers/sync/', views.sync_customers),
    path('distribution/sync/', views.sync_distribution),
]

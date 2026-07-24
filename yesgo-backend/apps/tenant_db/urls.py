"""数据底座路由"""
from django.urls import path
from . import views

urlpatterns = [
    path('products', views.products),
    path('inventory', views.inventory),
    path('orders', views.orders),
    path('customers', views.customers),
    path('distribution', views.distribution),
]

"""系统配置路由"""
from django.urls import path
from . import views

urlpatterns = [
    path('', views.config_root),
    path('dify', views.dify_root),
]

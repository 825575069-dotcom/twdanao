"""平台数据库路由"""
from django.urls import path
from . import views_database

urlpatterns = [
    # ===== 平台数据库 CRUD =====
    path('', views_database.platform_database_list, name='platform-database-list'),
    path('match-preview/', views_database.match_preview, name='platform-database-match-preview'),
    path('<int:pk>/', views_database.platform_database_detail, name='platform-database-detail'),
    path('<int:pk>/sync/', views_database.platform_database_sync, name='platform-database-sync'),
    # ===== 企业匹配 =====
    path('enterprises/<int:enterprise_pk>/match/', views_database.match_tenant, name='platform-enterprise-match'),
    path('tenants/<int:tenant_id>/match-all/', views_database.match_all_for_tenant, name='platform-match-all-for-tenant'),
]

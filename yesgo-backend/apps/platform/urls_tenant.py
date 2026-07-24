"""商户管理路由"""
from django.urls import path
from . import views

urlpatterns = [
    path('info', views.tenant_info),
    path('members', views.tenant_members),
    path('members/create', views.tenant_member_create),
    path('members/<str:member_id>', views.tenant_member_update),
    path('members/<str:member_id>/delete', views.tenant_member_delete),
    path('package', views.tenant_package),
    path('roles', views.tenant_roles),
    path('roles/create', views.tenant_role_create),
    path('roles/<str:role_id>', views.tenant_role_update),
    path('roles/<str:role_id>/delete', views.tenant_role_delete),
]

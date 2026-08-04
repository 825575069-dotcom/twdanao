"""平台管理后台 API（第二层：天网大脑平台权限管理）"""
from django.urls import path
from .views import (
    platform_permissions,
    platform_roles, platform_role_create, platform_role_update, platform_role_delete,
    platform_staff, platform_staff_create, platform_staff_update, platform_staff_delete,
)

urlpatterns = [
    # 平台权限清单
    path('permissions/', platform_permissions, name='admin-permissions'),
    # 平台角色
    path('roles/', platform_roles, name='admin-roles'),
    path('roles/create/', platform_role_create, name='admin-role-create'),
    path('roles/<str:role_id>/', platform_role_update, name='admin-role-update'),
    path('roles/<str:role_id>/delete/', platform_role_delete, name='admin-role-delete'),
    # 总部员工
    path('staff/', platform_staff, name='admin-staff'),
    path('staff/create/', platform_staff_create, name='admin-staff-create'),
    path('staff/<str:staff_id>/', platform_staff_update, name='admin-staff-update'),
    path('staff/<str:staff_id>/delete/', platform_staff_delete, name='admin-staff-delete'),
]

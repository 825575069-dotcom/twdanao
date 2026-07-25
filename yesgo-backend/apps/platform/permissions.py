"""权限检查工具 —— 第二层（天网大脑后端）API 鉴权"""
from functools import wraps
from typing import Callable, List

from django.http import HttpRequest

from .utils import api_error, API_CODE
from .models import Tenant, TenantUser


def get_user_permissions(user, tenant: Tenant | None = None) -> List[str]:
    """获取用户在指定租户下的权限清单（含 * 通配展开）"""
    if not user or not user.is_authenticated:
        return []
    # Django 超管/员工 is_staff 默认拥有全部权限
    if user.is_superuser or user.is_staff:
        return ['*']

    if tenant is None:
        # 未指定租户时取第一个有效 membership
        membership = user.tenant_memberships.select_related('role').first()
    else:
        try:
            membership = user.tenant_memberships.select_related('role').get(tenant=tenant)
        except TenantUser.DoesNotExist:
            membership = None

    if not membership or not membership.role:
        return []

    perms = membership.role.permissions or []
    if '*' in perms:
        # 通配权限：返回所有已知权限（由 PERMISSION_CATALOG 提供完整列表）
        from .views import PERMISSION_CATALOG
        return [p['code'] for p in PERMISSION_CATALOG]
    return perms


def has_permission(user, tenant: Tenant | None, perm_code: str) -> bool:
    """检查用户是否拥有指定权限"""
    perms = get_user_permissions(user, tenant)
    if '*' in perms:
        return True
    return perm_code in perms


def _get_request_tenant(request: HttpRequest) -> Tenant | None:
    """从请求中解析当前租户"""
    tenant_id = getattr(request, 'tenant_id', None)
    if tenant_id:
        try:
            return Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            pass
    return Tenant.objects.first()


def require_permission(perm_code: str):
    """API 视图装饰器：要求当前用户拥有指定权限

    用法（必须配合 @api_view + @permission_classes([IsAuthenticated]) 使用）：
        @api_view(['GET'])
        @permission_classes([IsAuthenticated])
        @require_permission('members.manage')
        def tenant_members(request):
            ...
    """
    def decorator(view_func: Callable):
        @wraps(view_func)
        def wrapper(request: HttpRequest, *args, **kwargs):
            tenant = _get_request_tenant(request)
            if not has_permission(request.user, tenant, perm_code):
                return api_error(code=API_CODE.FORBIDDEN, msg='无权限执行此操作')
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator

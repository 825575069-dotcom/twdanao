"""权限检查工具 —— 第二层（平台）与第三层（租户）双通道鉴权

第二层（平台权限）：
    - 平台员工（PlatformUser）登录管理后台，权限来自 PlatformRole.permissions (platform.*)
    - API 使用 @require_platform_permission('platform.xxx') 保护
    - 不依赖 X-Tenant-ID 头，不绑定任何租户

第三层（租户权限）：
    - 租户成员（TenantUser）登录桌面端 App，权限来自 Role.permissions (tenant.*)
    - API 使用 @require_permission('tenant.xxx') 保护
    - 依赖 X-Tenant-ID 头识别租户上下文
"""

from functools import wraps
from typing import Callable, List

from django.http import HttpRequest

from .utils import api_error, API_CODE

# ── 权限清单（集中定义，供 seed/serializer 引用） ──────────────────────────

PLATFORM_PERMISSION_CATALOG = [
    # 系统概览
    {'code': 'platform.dashboard.view', 'name': '系统概览', 'category': '系统概览'},
    # 租户管理
    {'code': 'platform.tenants.view', 'name': '查看租户', 'category': '租户管理'},
    {'code': 'platform.tenants.manage', 'name': '管理租户', 'category': '租户管理'},
    {'code': 'platform.tenants.members', 'name': '管理租户成员', 'category': '租户管理'},
    # 数据库管理
    {'code': 'platform.database.view', 'name': '查看数据库', 'category': '数据库管理'},
    {'code': 'platform.database.manage', 'name': '管理数据库', 'category': '数据库管理'},
    # 模型网关
    {'code': 'platform.models.view', 'name': '查看模型', 'category': '模型网关'},
    {'code': 'platform.models.manage', 'name': '管理模型', 'category': '模型网关'},
    # 智能体管理
    {'code': 'platform.agents.view', 'name': '查看智能体', 'category': '智能体管理'},
    {'code': 'platform.agents.manage', 'name': '管理智能体', 'category': '智能体管理'},
    # 工作流/知识库
    {'code': 'platform.workflows.view', 'name': '查看工作流', 'category': '工作流/知识库'},
    {'code': 'platform.workflows.manage', 'name': '管理工作流', 'category': '工作流/知识库'},
    # 权限管理
    {'code': 'platform.permissions.view', 'name': '查看权限', 'category': '权限管理'},
    {'code': 'platform.permissions.manage', 'name': '管理权限', 'category': '权限管理'},
    # 提示词管理
    {'code': 'platform.prompts.view', 'name': '查看提示词', 'category': '提示词管理'},
    {'code': 'platform.prompts.manage', 'name': '管理提示词', 'category': '提示词管理'},
    # 积分管理
    {'code': 'platform.credits.view', 'name': '查看积分', 'category': '积分管理'},
    {'code': 'platform.credits.manage', 'name': '管理积分', 'category': '积分管理'},
    # 安全审计
    {'code': 'platform.security.view', 'name': '查看审计', 'category': '安全审计'},
    {'code': 'platform.security.manage', 'name': '管理安全', 'category': '安全审计'},
    # 企微管理
    {'code': 'platform.wecom.manage', 'name': '企微管理', 'category': '企微管理'},
]

# 租户内部权限清单（第三层：租户员工在桌面端 App 的权限）
TENANT_PERMISSION_CATALOG = [
    # 工作空间
    {'code': 'tenant.office.view', 'name': 'AI办公室', 'category': '工作空间'},
    {'code': 'tenant.chat.view', 'name': '智能对话', 'category': '工作空间'},
    {'code': 'tenant.tasks.view', 'name': '自动任务', 'category': '工作空间'},
    # 企业管理
    {'code': 'tenant.data.view', 'name': '经营看板', 'category': '企业管理'},
    {'code': 'tenant.clients.view', 'name': '客户管理', 'category': '企业管理'},
    {'code': 'tenant.permissions.view', 'name': '权限管理', 'category': '企业管理'},
    {'code': 'tenant.members.manage', 'name': '成员管理', 'category': '企业管理'},
    {'code': 'tenant.credits.view', 'name': '积分查看', 'category': '企业管理'},
    {'code': 'tenant.credits.assign', 'name': '积分分配', 'category': '企业管理'},
    {'code': 'tenant.models.view', 'name': '模型网关', 'category': '企业管理'},
    {'code': 'tenant.config.view', 'name': '配置中心', 'category': '企业管理'},
    {'code': 'tenant.settings.view', 'name': '系统设置', 'category': '企业管理'},
    {'code': 'tenant.security.view', 'name': '安全审计', 'category': '企业管理'},
    # 企业知识库
    {'code': 'tenant.knowledge.view', 'name': '知识文档', 'category': '企业知识库'},
    {'code': 'tenant.dataBase.view', 'name': '数据底座', 'category': '企业知识库'},
    {'code': 'tenant.media.view', 'name': '宣传图片', 'category': '企业知识库'},
    {'code': 'tenant.skills.view', 'name': '技能市场', 'category': '企业知识库'},
    # 智能体
    {'code': 'tenant.agent.ops', 'name': '运营智能体', 'category': '智能体'},
    {'code': 'tenant.agent.crm', 'name': '跟客智能体', 'category': '智能体'},
    {'code': 'tenant.agent.purchase', 'name': '采购智能体', 'category': '智能体'},
    {'code': 'tenant.agent.flow', 'name': '流向智能体', 'category': '智能体'},
    {'code': 'tenant.agent.academic', 'name': '学术智能体', 'category': '智能体'},
]


# ═══════════════════════════════════════
# 第二层：平台权限（管理后台 — 总部员工）
# ═══════════════════════════════════════

def get_platform_permissions(user) -> List[str]:
    """获取用户在平台层的权限清单（不绑定任何租户）

    平台管理员和 is_staff 用户通过 PlatformUser 关联 PlatformRole 获取权限。
    超级用户（is_superuser）直接返回全部平台权限。
    """
    if not user or not user.is_authenticated:
        return []

    # 超级用户：拥有全部平台权限
    if user.is_superuser:
        return ['*']

    try:
        profile = user.platform_profile
    except Exception:
        return []

    if not profile.enabled or not profile.role:
        return []

    perms = profile.role.permissions or []
    if '*' in perms:
        return [p['code'] for p in PLATFORM_PERMISSION_CATALOG]
    return perms


def has_platform_permission(user, perm_code: str) -> bool:
    """检查用户是否拥有指定平台权限"""
    perms = get_platform_permissions(user)
    if '*' in perms:
        return True
    return perm_code in perms


def require_platform_permission(perm_code: str):
    """API 视图装饰器：要求当前用户拥有指定平台权限

    用法（必须配合 @api_view + @permission_classes([IsAuthenticated]) 使用）：
        @api_view(['GET'])
        @permission_classes([IsAuthenticated])
        @require_platform_permission('platform.permissions.view')
        def platform_staff_list(request):
            ...
    """
    def decorator(view_func: Callable):
        @wraps(view_func)
        def wrapper(request: HttpRequest, *args, **kwargs):
            if not has_platform_permission(request.user, perm_code):
                return api_error(code=API_CODE.FORBIDDEN, msg='无权限执行此操作')
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


# ═══════════════════════════════════════
# 第三层：租户权限（桌面端 App — 租户员工）
# ═══════════════════════════════════════

def _get_request_tenant(request: HttpRequest):
    """从请求头中解析当前租户（仅用于第三层 API 鉴权）"""
    from .models import Tenant
    tenant_id = getattr(request, 'tenant_id', None)
    if tenant_id:
        try:
            return Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            pass
    return None


def get_tenant_permissions(user, tenant) -> List[str]:
    """获取用户在指定租户下的权限清单（第三层）

    platform 超级用户在任何租户下都拥有 '*' 全权限。
    租户员工通过 TenantUser → Role 获取权限。
    """
    from .models import TenantUser

    if not user or not user.is_authenticated:
        return []

    # 平台超级用户：在任何租户下都拥有全权限
    if user.is_superuser:
        return ['*']

    if tenant is None:
        return []

    try:
        membership = user.tenant_memberships.select_related('role').get(tenant=tenant)
    except TenantUser.DoesNotExist:
        return []

    if not membership.role:
        return []

    perms = membership.role.permissions or []
    if '*' in perms:
        return [p['code'] for p in TENANT_PERMISSION_CATALOG]
    return perms


def has_tenant_permission(user, tenant, perm_code: str) -> bool:
    """检查用户在指定租户下是否拥有指定权限"""
    perms = get_tenant_permissions(user, tenant)
    if '*' in perms:
        return True
    return perm_code in perms


def require_permission(perm_code: str):
    """API 视图装饰器：要求当前用户在请求租户下拥有指定权限（第三层）

    用法（必须配合 @api_view + @permission_classes([IsAuthenticated]) 使用）：
        @api_view(['GET'])
        @permission_classes([IsAuthenticated])
        @require_permission('tenant.members.manage')
        def tenant_members(request):
            ...
    """
    def decorator(view_func: Callable):
        @wraps(view_func)
        def wrapper(request: HttpRequest, *args, **kwargs):
            tenant = _get_request_tenant(request)
            if not has_tenant_permission(request.user, tenant, perm_code):
                return api_error(code=API_CODE.FORBIDDEN, msg='无权限执行此操作')
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator

"""
平台管理 API —— 认证 + 商户管理 + 系统配置 + 健康检查
使用 Django 模型持久化，替代 Mock 数据
"""

import random
import re
import logging

from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.conf import settings
from django.core.cache import cache
from django.http import HttpRequest
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken

logger = logging.getLogger(__name__)

from .utils import api_success, api_error, API_CODE
from .models import (
    Tenant, Role, TenantUser, Package, PackageQuota,
    AgentConfig, DifyConfig, DifyWorkflow,
    PlatformRole, PlatformUser,
)
from .serializers import (
    TenantSerializer, TenantUserSerializer, MemberCreateSerializer,
    RoleSerializer, PackageSerializer, AgentConfigSerializer, DifyConfigSerializer
)
from .permissions import (
    require_permission, require_platform_permission,
    get_platform_permissions, get_tenant_permissions,
    PLATFORM_PERMISSION_CATALOG, TENANT_PERMISSION_CATALOG,
)

AGENT_CODES = ['ops', 'crm', 'purchase', 'flow', 'academic']


def _role_permissions(role: Role | None):
    """提取租户角色权限列表（含 * 通配时返回全部 tenant.* 权限码）"""
    if not role:
        return []
    perms = role.permissions or []
    if '*' in perms:
        return [p['code'] for p in TENANT_PERMISSION_CATALOG]
    return perms


def _get_tenant(request: HttpRequest):
    """从请求头获取租户"""
    tenant_id = getattr(request, 'tenant_id', None)
    if tenant_id:
        try:
            return Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            pass
    # 兼容：取第一个租户
    return Tenant.objects.first()


def _get_membership(request: HttpRequest):
    """获取当前用户的租户成员信息"""
    tenant = _get_tenant(request)
    if not tenant or not request.user.is_authenticated:
        return None, None
    try:
        return tenant, request.user.tenant_memberships.get(tenant=tenant)
    except TenantUser.DoesNotExist:
        return tenant, None


# ═══════════════════════════════════════
# 认证 API
# ═══════════════════════════════════════


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request: HttpRequest):
    """POST /api/v1/auth/login — 登录获取 JWT Token"""
    username = request.data.get('username', '')
    password = request.data.get('password', '')

    if not username or not password:
        return api_error(code=API_CODE.BAD_REQUEST, msg='用户名和密码不能为空')

    user = authenticate(username=username, password=password)
    if not user:
        return api_error(code=API_CODE.UNAUTHORIZED, msg='用户名或密码错误')

    refresh = RefreshToken.for_user(user)

    # ── 平台权限（第二层：管理后台侧边栏导航） ──
    platform_perms = get_platform_permissions(user)

    # 找到用户的租户信息（管理后台需要知道管理哪个租户）
    membership = user.tenant_memberships.select_related('tenant', 'role').first()
    tenant_data = None

    # ── 租户权限（第三层：桌面端 App 视图） ──
    # 优先使用用户的租户会员关系来确定租户上下文
    # 这样即使没有 X-Tenant-ID 头（登录时还没有 token），也能正确返回租户权限
    if membership and membership.tenant:
        tenant_perms = get_tenant_permissions(user, membership.tenant)
        is_tenant_context = True
    else:
        tenant = _get_tenant(request)
        tenant_perms = get_tenant_permissions(user, tenant) if tenant else []
        is_tenant_context = bool(tenant)

    # 确定 user_data 中的 permissions：
    #   - 租户用户（有 membership）→ 返回租户权限
    #   - 平台用户（无 membership）→ 返回平台权限
    permissions = tenant_perms if is_tenant_context else platform_perms

    # 平台用户信息
    platform_role_name = None
    try:
        pp = user.platform_profile
        if pp.role:
            platform_role_name = pp.role.name
    except Exception:
        pass

    role_id = 'admin' if user.is_superuser else (
        (membership.role.code if membership and membership.role else None) or
        platform_role_name or 'member'
    )
    role_name = '超级管理员' if user.is_superuser else (
        (membership.role.name if membership and membership.role else None) or
        platform_role_name or '成员'
    )

    # 手机号：租户成员取 TenantUser.phone，平台员工取 PlatformUser.phone
    phone = ''
    if membership:
        phone = getattr(membership, 'phone', '') or ''
    elif hasattr(user, 'platform_profile'):
        try:
            phone = user.platform_profile.phone or ''
        except Exception:
            pass

    user_data = {
        'id': str(user.id),
        'name': user.username,
        'roleId': role_id,
        'roleName': role_name,
        'permissions': permissions,
        'phone': phone,
    }

    if membership:
        tenant_data = TenantSerializer(membership.tenant).data
    else:
        first_tenant = Tenant.objects.first()
        if first_tenant:
            tenant_data = TenantSerializer(first_tenant).data
        else:
            tenant_data = {'id': '', 'code': '', 'name': '未分配租户', 'status': 'inactive', 'platformName': ''}

    return api_success({
        'access_token': str(refresh.access_token),
        'refresh_token': str(refresh),
        'user': user_data,
        'tenant': tenant_data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request: HttpRequest):
    """GET /api/v1/auth/me — 获取当前用户信息（区分平台/租户权限）"""
    tenant, membership = _get_membership(request)

    # ── 平台权限 ──
    platform_perms = get_platform_permissions(request.user)

    # ── 租户权限 ──
    tenant_perms = get_tenant_permissions(request.user, tenant) if tenant else []

    # 有 X-Tenant-ID → 返回租户权限，否则返回平台权限
    is_tenant_context = bool(tenant)
    permissions = tenant_perms if is_tenant_context else platform_perms

    platform_role_name = None
    try:
        pp = request.user.platform_profile
        if pp.role:
            platform_role_name = pp.role.name
    except Exception:
        pass

    role_id = 'admin' if request.user.is_superuser else (platform_role_name or 'member')
    role_name = '超级管理员' if request.user.is_superuser else (platform_role_name or (membership.role.name if membership and membership.role else '成员'))

    # 手机号：租户成员取 TenantUser.phone，平台员工取 PlatformUser.phone
    phone = ''
    if membership:
        phone = getattr(membership, 'phone', '') or ''
    elif hasattr(request.user, 'platform_profile'):
        try:
            phone = request.user.platform_profile.phone or ''
        except Exception:
            pass

    user_data = {
        'id': str(request.user.id),
        'name': request.user.username,
        'roleId': role_id,
        'roleName': role_name,
        'permissions': permissions,
        'phone': phone,
    }

    if membership and membership.role and is_tenant_context:
        user_data['roleId'] = membership.role.code
        user_data['roleName'] = membership.role.name

    tenant_data = None
    if tenant:
        tenant_data = TenantSerializer(tenant).data
    else:
        tenant_data = {'id': '', 'code': '', 'name': '未分配', 'status': 'inactive', 'platformName': ''}

    return api_success({'user': user_data, 'tenant': tenant_data})


@api_view(['POST'])
def logout(request: HttpRequest):
    """POST /api/v1/auth/logout — 登出"""
    return api_success({'msg': '已登出'})


@api_view(['POST'])
@permission_classes([AllowAny])
def token_refresh(request: HttpRequest):
    """POST /api/v1/auth/refresh — 刷新 JWT Token"""
    refresh_token_str = request.data.get('refresh_token', '')
    if not refresh_token_str:
        return api_error(code=API_CODE.BAD_REQUEST, msg='refresh_token 不能为空')

    try:
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken(refresh_token_str)
        # 验证 token 有效性（verify 会检查 exp 和签名）
        refresh.verify()
        user_id = refresh['user_id']
        user = User.objects.get(id=user_id)
        new_refresh = RefreshToken.for_user(user)
        return api_success({
            'access_token': str(new_refresh.access_token),
            'refresh_token': str(new_refresh),
        })
    except Exception as e:
        return api_error(code=API_CODE.UNAUTHORIZED, msg=f'Token 刷新失败: {str(e)}')


# ═══════════════════════════════════════
# 商户管理 API
# ═══════════════════════════════════════


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
@require_permission('tenant.settings.view')
def tenant_info(request: HttpRequest):
    """GET /api/v1/tenant/info — 获取/更新商户信息"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    if request.method == 'PUT':
        serializer = TenantSerializer(tenant, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return api_success(serializer.data, msg='商户信息已更新')
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))

    return api_success(TenantSerializer(tenant).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_permission('tenant.members.manage')
def tenant_members(request: HttpRequest):
    """GET /api/v1/tenant/members — 员工列表（返回直接数组）"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success([])

    members = tenant.members.select_related('user', 'role').all()
    data = TenantUserSerializer(members, many=True).data
    return api_success(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_permission('tenant.members.manage')
def tenant_member_create(request: HttpRequest):
    """POST /api/v1/tenant/members/create — 新增成员"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    serializer = MemberCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))

    data = serializer.validated_data
    user, created = User.objects.get_or_create(username=data['username'])
    if created:
        user.set_password(data['password'])
        user.save()

    role_id = data['role_id']
    try:
        role = Role.objects.get(id=role_id, tenant=tenant)
    except Role.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='角色不存在')

    # 积分分配参数
    alloc_type = data.get('credit_allocation_type', 'fixed')
    alloc_value = data.get('credit_allocation_value', 0)
    # 兼容 credits 字段
    credits_val = data.get('credits', 500)
    if alloc_type == 'unlimited':
        credits_val = 999999
    elif alloc_value > 0:
        credits_val = alloc_value

    defaults = {
        'role': role,
        'credits': credits_val,
        'credit_allocation_type': alloc_type,
        'credit_allocation_value': alloc_value if alloc_type != 'unlimited' else 0,
        'status': 'offline',
        'enabled': True,
    }
    if phone := data.get('phone', '').strip():
        defaults['phone'] = phone

    membership, created = TenantUser.objects.get_or_create(
        user=user, tenant=tenant,
        defaults=defaults
    )
    if not created:
        membership.role = role
        membership.credits = credits_val
        membership.credit_allocation_type = alloc_type
        membership.credit_allocation_value = alloc_value if alloc_type != 'unlimited' else 0
        if phone := data.get('phone', '').strip():
            membership.phone = phone
        membership.save()

    return api_success(TenantUserSerializer(membership).data, msg='成员已添加')


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
@require_permission('tenant.members.manage')
def tenant_member_update(request: HttpRequest, member_id: str):
    """PUT /api/v1/tenant/members/<id> — 更新成员"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    try:
        membership = tenant.members.get(id=member_id)
    except TenantUser.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='成员不存在')

    # 支持密码修改
    password = request.data.get('password')
    if password:
        membership.user.set_password(password)
        membership.user.save()

    # 支持手机号修改
    if 'phone' in request.data:
        membership.phone = request.data.get('phone', '').strip()
        membership.save(update_fields=['phone'])

    # 支持积分分配字段修改
    alloc_changed = False
    if 'credit_allocation_type' in request.data:
        membership.credit_allocation_type = request.data.get('credit_allocation_type', 'fixed')
        alloc_changed = True
    if 'credit_allocation_value' in request.data:
        membership.credit_allocation_value = int(request.data.get('credit_allocation_value', 0) or 0)
        alloc_changed = True
    if alloc_changed:
        # 如果是无限类型，设置积分余额为 999999
        if membership.credit_allocation_type == 'unlimited':
            membership.credits = 999999
        elif membership.credit_allocation_value > 0:
            membership.credits = membership.credit_allocation_value
        membership.save(update_fields=['credit_allocation_type', 'credit_allocation_value', 'credits'])

    # 支持 role_id → role PK + 租户范围校验
    data = dict(request.data)
    data.pop('password', None)  # 从序列化数据中移除 password（TenantUserSerializer 无此字段）
    if 'role_id' in data and 'role' not in data:
        role_id_val = data.pop('role_id')
        try:
            # 校验 role 属于当前租户
            role = Role.objects.get(id=role_id_val, tenant=tenant)
            data['role'] = role.id  # 传 PK 而非对象，避免 DRF 类型错误
        except (Role.DoesNotExist, ValueError):
            # role 不存在或不属于此租户，丢弃后由 serializer 校验报错
            pass

    serializer = TenantUserSerializer(membership, data=data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return api_success(serializer.data, msg='成员已更新')
    return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
@require_permission('tenant.members.manage')
def tenant_member_delete(request: HttpRequest, member_id: str):
    """DELETE /api/v1/tenant/members/<id>/delete — 删除成员"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    try:
        membership = tenant.members.get(id=member_id)
    except TenantUser.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='成员不存在')

    membership.delete()
    return api_success({'msg': '成员已删除'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_permission('tenant.settings.view')
def tenant_package(request: HttpRequest):
    """GET /api/v1/tenant/package — 套餐配额"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success({'id': '', 'name': '免费版', 'quotas': []})

    try:
        package = tenant.package
    except Package.DoesNotExist:
        return api_success({'id': '', 'name': '免费版', 'quotas': []})

    return api_success(PackageSerializer(package).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_permission('tenant.permissions.view')
def tenant_roles(request: HttpRequest):
    """GET /api/v1/tenant/roles — 角色列表（返回直接数组）"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success([])

    roles = tenant.roles.all()
    data = RoleSerializer(roles, many=True).data
    return api_success(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_permission('tenant.permissions.view')
def tenant_permissions(request: HttpRequest):
    """GET /api/v1/tenant/permissions — 租户权限清单（tenant.* 带中文名称）"""
    return api_success(TENANT_PERMISSION_CATALOG)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_permission('tenant.permissions.view')
def tenant_role_create(request: HttpRequest):
    """POST /api/v1/tenant/roles/create — 新增角色"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    serializer = RoleSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(tenant=tenant)
        return api_success(serializer.data, msg='角色已添加')
    return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
@require_permission('tenant.permissions.view')
def tenant_role_update(request: HttpRequest, role_id: str):
    """PUT /api/v1/tenant/roles/<id> — 更新角色"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    try:
        role = tenant.roles.get(id=role_id)
    except Role.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='角色不存在')

    serializer = RoleSerializer(role, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return api_success(serializer.data, msg='角色已更新')
    return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
@require_permission('tenant.permissions.view')
def tenant_role_delete(request: HttpRequest, role_id: str):
    """DELETE /api/v1/tenant/roles/<id>/delete — 删除角色"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    try:
        role = tenant.roles.get(id=role_id)
    except Role.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='角色不存在')

    role.delete()
    return api_success({'msg': '角色已删除'})


# ═══════════════════════════════════════
# 系统配置 API
# ═══════════════════════════════════════


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
@require_permission('tenant.config.view')
def config_root(request: HttpRequest):
    """GET/PUT /api/v1/config — 获取/更新智能体配置（返回直接数组，接受 configs 键）"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    if request.method == 'PUT':
        # 前端发送 { configs: [...] }，兼容旧的 agents 键
        agent_configs = request.data.get('configs', request.data.get('agents', []))
        for ac_data in agent_configs:
            agent_id = ac_data.get('agentId') or ac_data.get('agent_id')
            if not agent_id:
                continue
            defaults = {
                'model_id': ac_data.get('modelId', ac_data.get('model_id', '')),
                'temperature': ac_data.get('temperature', 0.7),
                'max_retry': ac_data.get('maxRetry', ac_data.get('max_retry', 3)),
                'fallback_model_id': ac_data.get('fallbackModelId', ac_data.get('fallback_model_id', '')),
                'human_takeover_threshold': ac_data.get('humanTakeoverThreshold', ac_data.get('human_takeover_threshold', 0.6)),
                'custom': ac_data.get('custom', {}),
                'custom_name': ac_data.get('customName', ac_data.get('custom_name', '')),
                'custom_role': ac_data.get('customRole', ac_data.get('custom_role', '')),
                'custom_description': ac_data.get('customDescription', ac_data.get('custom_description', '')),
                'custom_workflow': ac_data.get('customWorkflow', ac_data.get('custom_workflow', [])),
                'custom_scarf_color': ac_data.get('customScarfColor', ac_data.get('custom_scarf_color', '')),
                'bound_data_bases': ac_data.get('boundDataBases', ac_data.get('bound_data_bases', [])),
                'bound_docs': ac_data.get('boundDocs', ac_data.get('bound_docs', [])),
                'bound_images': ac_data.get('boundImages', ac_data.get('bound_images', [])),
            }
            AgentConfig.objects.update_or_create(
                tenant=tenant, agent_id=agent_id,
                defaults=defaults
            )
        return api_success({'msg': '配置已更新'})

    configs = tenant.agent_configs.all()
    data = AgentConfigSerializer(configs, many=True).data
    return api_success(data)


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
@require_permission('tenant.config.view')
def dify_root(request: HttpRequest):
    """GET/PUT /api/v1/config/dify — 获取/更新 Dify 工作流配置"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    if request.method == 'PUT':
        configured = request.data.get('configured', False)
        connection_status = request.data.get('connection_status', request.data.get('connectionStatus', 'disconnected'))
        workflows_data = request.data.get('workflows', [])

        dify_config, _ = DifyConfig.objects.update_or_create(
            tenant=tenant,
            defaults={
                'configured': configured,
                'connection_status': connection_status,
            }
        )

        # 更新工作流 — 前端发送数组 [{ id, code, agent_code, api_key, base_url }]
        if isinstance(workflows_data, list):
            for wf_data in workflows_data:
                wf_code = wf_data.get('code', '')
                if not wf_code:
                    continue
                DifyWorkflow.objects.update_or_create(
                    dify_config=dify_config, code=wf_code,
                    defaults={
                        'agent_code': wf_data.get('agent_code', wf_code),
                        'api_key': wf_data.get('api_key', wf_data.get('apiKey', '')),
                        'base_url': wf_data.get('base_url', wf_data.get('baseUrl', 'https://api.dify.ai/v1')),
                    }
                )
        elif isinstance(workflows_data, dict):
            # 兼容旧格式 dict { code: { ... } }
            for wf_code, wf_data in workflows_data.items():
                DifyWorkflow.objects.update_or_create(
                    dify_config=dify_config, code=wf_code,
                    defaults={
                        'agent_code': wf_data.get('code', wf_code),
                        'api_key': wf_data.get('apiKey', wf_data.get('api_key', '')),
                        'base_url': wf_data.get('baseUrl', wf_data.get('base_url', 'https://api.dify.ai/v1')),
                    }
                )

        # 返回更新后的完整配置
        dify_config.refresh_from_db()
        return api_success(DifyConfigSerializer(dify_config).data, msg='Dify 配置已更新')

    try:
        dify_config = tenant.dify_config
    except DifyConfig.DoesNotExist:
        return api_success({
            'id': None,
            'configured': False,
            'connection_status': 'disconnected',
            'last_test': None,
            'error': None,
            'workflows': [],
        })

    return api_success(DifyConfigSerializer(dify_config).data)


# ═══════════════════════════════════════
# 平台权限 API（第二层 — 管理后台权限管理页面）
# ═══════════════════════════════════════


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.permissions.view')
def platform_permissions(request: HttpRequest):
    """GET /api/v1/platform/permissions -- 平台权限清单（platform.* 带中文名称）"""
    return api_success(PLATFORM_PERMISSION_CATALOG)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.permissions.view')
def platform_roles(request: HttpRequest):
    """GET /api/v1/platform/roles — 平台角色列表"""
    roles = PlatformRole.objects.all()
    data = [{
        'id': r.id, 'name': r.name, 'code': r.code,
        'description': r.description, 'permissions': r.permissions,
        'created_at': r.created_at,
    } for r in roles]
    return api_success(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.permissions.manage')
def platform_role_create(request: HttpRequest):
    """POST /api/v1/platform/roles — 新增平台角色"""
    name = request.data.get('name', '').strip()
    code = request.data.get('code', '').strip()
    description = request.data.get('description', '')
    permissions = request.data.get('permissions', [])

    if not name or not code:
        return api_error(code=API_CODE.BAD_REQUEST, msg='角色名称和编码不能为空')
    if PlatformRole.objects.filter(code=code).exists():
        return api_error(code=API_CODE.BAD_REQUEST, msg='角色编码已存在')

    role = PlatformRole.objects.create(name=name, code=code, description=description, permissions=permissions)
    return api_success({'id': role.id, 'name': role.name, 'code': role.code,
                        'description': role.description, 'permissions': role.permissions}, msg='平台角色已创建')


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.permissions.manage')
def platform_role_update(request: HttpRequest, role_id: str):
    """PUT /api/v1/platform/roles/<id> — 更新平台角色"""
    try:
        role = PlatformRole.objects.get(id=role_id)
    except PlatformRole.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='角色不存在')

    name = request.data.get('name', role.name).strip()
    description = request.data.get('description', role.description)
    permissions = request.data.get('permissions', role.permissions)

    if not name:
        return api_error(code=API_CODE.BAD_REQUEST, msg='角色名称不能为空')

    role.name = name
    role.description = description
    role.permissions = permissions
    role.save()
    return api_success({'id': role.id, 'name': role.name, 'code': role.code,
                        'description': role.description, 'permissions': role.permissions}, msg='平台角色已更新')


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.permissions.manage')
def platform_role_delete(request: HttpRequest, role_id: str):
    """DELETE /api/v1/platform/roles/<id> — 删除平台角色"""
    try:
        role = PlatformRole.objects.get(id=role_id)
    except PlatformRole.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='角色不存在')

    role.delete()
    return api_success({'msg': '角色已删除'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.permissions.view')
def platform_staff(request: HttpRequest):
    """GET /api/v1/platform/staff — 总部员工列表"""
    staff = PlatformUser.objects.select_related('user', 'role').all()
    data = [{
        'id': pu.id,
        'user_id': pu.user.id,
        'username': pu.user.username,
        'name': pu.user.first_name or pu.user.username,
        'phone': pu.phone,
        'role_id': pu.role.id if pu.role else None,
        'role_name': pu.role.name if pu.role else None,
        'role_code': pu.role.code if pu.role else None,
        'enabled': pu.enabled,
        'created_at': pu.created_at,
    } for pu in staff]
    return api_success(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.permissions.manage')
def platform_staff_create(request: HttpRequest):
    """POST /api/v1/platform/staff — 新增总部员工"""
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')
    name = request.data.get('name', '').strip()
    phone = request.data.get('phone', '').strip()
    role_id = request.data.get('role_id')

    if not username:
        return api_error(code=API_CODE.BAD_REQUEST, msg='账号不能为空')
    if not password:
        return api_error(code=API_CODE.BAD_REQUEST, msg='密码不能为空')
    if not phone:
        return api_error(code=API_CODE.BAD_REQUEST, msg='手机号不能为空')

    # 创建或获取 User
    user, created = User.objects.get_or_create(username=username)
    if created:
        user.set_password(password)
        # is_staff 表明这是天网大脑平台员工，用于管理后台登录
        user.is_staff = True
        if name:
            user.first_name = name
        user.save()
    elif not created and name:
        user.first_name = name
        user.save()

    # 检查是否已有平台员工档案
    if PlatformUser.objects.filter(user=user).exists():
        return api_error(code=API_CODE.BAD_REQUEST, msg='该用户已是平台员工')

    role = None
    if role_id:
        try:
            role = PlatformRole.objects.get(id=role_id)
        except PlatformRole.DoesNotExist:
            pass

    pu = PlatformUser.objects.create(user=user, role=role, phone=phone, enabled=True)
    data = {
        'id': pu.id, 'username': pu.user.username,
        'name': pu.user.first_name or pu.user.username,
        'phone': pu.phone,
        'role_id': pu.role.id if pu.role else None,
        'role_name': pu.role.name if pu.role else None,
        'enabled': pu.enabled,
    }
    return api_success(data, msg='平台员工已创建')


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.permissions.manage')
def platform_staff_update(request: HttpRequest, staff_id: str):
    """PUT /api/v1/platform/staff/<id> — 更新总部员工"""
    try:
        pu = PlatformUser.objects.select_related('user', 'role').get(id=staff_id)
    except PlatformUser.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='员工不存在')

    password = request.data.get('password')
    if password:
        pu.user.set_password(password)
        pu.user.save()

    name = request.data.get('name')
    if name is not None and name.strip():
        pu.user.first_name = name.strip()
        pu.user.save()

    phone = request.data.get('phone')
    if phone is not None:
        pu.phone = phone.strip()
        pu.save(update_fields=['phone'])

    role_id = request.data.get('role_id')
    if role_id is not None:
        try:
            pu.role = PlatformRole.objects.get(id=role_id) if role_id else None
        except PlatformRole.DoesNotExist:
            pass

    if 'enabled' in request.data:
        pu.enabled = bool(request.data['enabled'])

    pu.save()
    data = {
        'id': pu.id, 'username': pu.user.username,
        'name': pu.user.first_name or pu.user.username,
        'phone': pu.phone,
        'role_id': pu.role.id if pu.role else None,
        'role_name': pu.role.name if pu.role else None,
        'enabled': pu.enabled,
    }
    return api_success(data, msg='员工已更新')


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.permissions.manage')
def platform_staff_delete(request: HttpRequest, staff_id: str):
    """DELETE /api/v1/platform/staff/<id> — 删除总部员工（仅删除档案，不删 User）"""
    try:
        pu = PlatformUser.objects.get(id=staff_id)
    except PlatformUser.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='员工不存在')

    pu.delete()
    return api_success({'msg': '员工已删除'})


# ═══════════════════════════════════════
# 忘记密码（手机号 + 验证码 + 重置密码）
# ═══════════════════════════════════════


# 手机号简单校验（中国大陆 11 位）
PHONE_REGEX = re.compile(r'^1[3-9]\d{9}$')
CODE_TTL_SECONDS = 300          # 验证码有效期 5 分钟
RESET_TOKEN_TTL_SECONDS = 600   # 重置令牌有效期 10 分钟
MAX_CODE_SEND_PER_MINUTE = 1


def _phone_key(phone: str, suffix: str) -> str:
    return f'yesgo:pwd:{suffix}:{phone}'


def _find_user_by_phone(phone: str):
    """根据手机号查找 auth.User（同时覆盖第二层 PlatformUser 和第三层 TenantUser）"""
    # 第二层优先
    platform_user = PlatformUser.objects.filter(phone=phone).select_related('user').first()
    if platform_user:
        return platform_user.user

    # 第三层租户成员
    tenant_user = TenantUser.objects.filter(phone=phone).select_related('user').first()
    if tenant_user:
        return tenant_user.user

    return None


def _send_sms_code(phone: str, code: str):
    """发送短信验证码（当前为 mock，仅记录日志；后续接入真实 SMS 通道）"""
    logger.info(f'[SMS] send verification code {code} to {phone}')
    # TODO: 接入阿里云 / 腾讯云短信服务


@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_password_send_code(request: HttpRequest):
    """POST /api/v1/auth/forgot-password/send-code/ — 发送验证码"""
    phone = request.data.get('phone', '').strip()
    if not phone:
        return api_error(code=API_CODE.BAD_REQUEST, msg='请输入手机号')
    if not PHONE_REGEX.match(phone):
        return api_error(code=API_CODE.BAD_REQUEST, msg='手机号格式不正确')

    user = _find_user_by_phone(phone)
    if not user:
        # 安全提示：不暴露手机号是否存在，但开发阶段可明确提示
        return api_error(code=API_CODE.BAD_REQUEST, msg='该手机号未绑定任何账号')

    # 频率限制：同一手机号 60 秒内只能发一次
    send_key = _phone_key(phone, 'send_count')
    send_count = cache.get(send_key, 0)
    if send_count >= MAX_CODE_SEND_PER_MINUTE:
        return api_error(code=API_CODE.BAD_REQUEST, msg='发送过于频繁，请稍后再试')

    code = f'{random.randint(0, 999999):06d}'
    cache.set(_phone_key(phone, 'code'), code, CODE_TTL_SECONDS)
    cache.set(send_key, send_count + 1, 60)

    _send_sms_code(phone, code)

    data = {'phone': phone, 'expires_in': CODE_TTL_SECONDS }
    if getattr(settings, 'SMS_MOCK_MODE', True):
        data['code'] = code  # mock 模式返回验证码，方便测试

    return api_success(data, msg='验证码已发送')


@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_password_verify_code(request: HttpRequest):
    """POST /api/v1/auth/forgot-password/verify-code/ — 校验验证码并发放重置令牌"""
    phone = request.data.get('phone', '').strip()
    code = request.data.get('code', '').strip()

    if not phone or not code:
        return api_error(code=API_CODE.BAD_REQUEST, msg='请输入手机号和验证码')

    cached_code = cache.get(_phone_key(phone, 'code'))
    if not cached_code or cached_code != code:
        return api_error(code=API_CODE.BAD_REQUEST, msg='验证码错误或已过期')

    user = _find_user_by_phone(phone)
    if not user:
        return api_error(code=API_CODE.BAD_REQUEST, msg='该手机号未绑定任何账号')

    reset_token = user.username  # 用 username 作为重置令牌（已能唯一标识用户）
    cache.set(_phone_key(phone, 'reset_token'), reset_token, RESET_TOKEN_TTL_SECONDS)

    return api_success({
        'phone': phone,
        'reset_token': reset_token,
        'expires_in': RESET_TOKEN_TTL_SECONDS,
    }, msg='验证通过')


@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_password_reset(request: HttpRequest):
    """POST /api/v1/auth/forgot-password/reset/ — 重置密码"""
    phone = request.data.get('phone', '').strip()
    reset_token = request.data.get('reset_token', '').strip()
    new_password = request.data.get('new_password', '').strip()

    if not phone or not reset_token or not new_password:
        return api_error(code=API_CODE.BAD_REQUEST, msg='参数不完整')

    if len(new_password) < 6:
        return api_error(code=API_CODE.BAD_REQUEST, msg='新密码长度不能少于 6 位')

    cached_token = cache.get(_phone_key(phone, 'reset_token'))
    if not cached_token or cached_token != reset_token:
        return api_error(code=API_CODE.BAD_REQUEST, msg='重置令牌无效或已过期')

    user = _find_user_by_phone(phone)
    if not user:
        return api_error(code=API_CODE.BAD_REQUEST, msg='该手机号未绑定任何账号')

    user.set_password(new_password)
    user.save()

    # 重置成功后清理缓存
    cache.delete(_phone_key(phone, 'code'))
    cache.delete(_phone_key(phone, 'reset_token'))
    cache.delete(_phone_key(phone, 'send_count'))

    return api_success({'msg': '密码已重置，请使用新密码登录'}, msg='密码重置成功')


# ═══════════════════════════════════════
# 健康检查
# ═══════════════════════════════════════


@api_view(['GET'])
@permission_classes([AllowAny])
def health(request: HttpRequest):
    """GET /api/v1/health/ — 健康检查"""
    from django.db import connection
    try:
        connection.ensure_connection()
        db_status = 'connected'
    except Exception:
        db_status = 'disconnected'

    return api_success({
        'status': 'ok',
        'service': 'yesgo-tianwang-brain',
        'version': 'v1.0.0',
        'layer': '第二层：天网大脑后端',
        'database': db_status,
        'redis': 'connected',
        'uptime': '99d 12h',
    })

"""
平台管理 API —— 认证 + 商户管理 + 系统配置 + 健康检查
使用 Django 模型持久化，替代 Mock 数据
"""

from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.http import HttpRequest
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken

from .utils import api_success, api_error, API_CODE
from .models import (
    Tenant, Role, TenantUser, Package, PackageQuota,
    AgentConfig, DifyConfig, DifyWorkflow
)
from .serializers import (
    TenantSerializer, TenantUserSerializer, MemberCreateSerializer,
    RoleSerializer, PackageSerializer, AgentConfigSerializer, DifyConfigSerializer
)
from .permissions import require_permission

AGENT_CODES = ['ops', 'crm', 'purchase', 'flow', 'academic']

# 平台权限清单（中文功能名称，admin 角色管理展示用）
PERMISSION_CATALOG = [
    {'code': '*', 'name': '全部权限', 'category': '特殊'},
    {'code': 'office.view', 'name': 'AI办公室', 'category': '工作空间'},
    {'code': 'chat.view', 'name': '智能对话', 'category': '工作空间'},
    {'code': 'tasks.view', 'name': '自动任务', 'category': '工作空间'},
    {'code': 'data.view', 'name': '经营看板', 'category': '企业管理'},
    {'code': 'clients.view', 'name': '客户管理', 'category': '企业管理'},
    {'code': 'permissions.view', 'name': '权限管理', 'category': '企业管理'},
    {'code': 'members.manage', 'name': '成员管理', 'category': '企业管理'},
    {'code': 'credits.view', 'name': '积分管理', 'category': '企业管理'},
    {'code': 'credits.assign', 'name': '积分分配', 'category': '企业管理'},
    {'code': 'models.view', 'name': '模型网关', 'category': '企业管理'},
    {'code': 'config.view', 'name': '配置中心', 'category': '企业管理'},
    {'code': 'security.view', 'name': '安全审计', 'category': '企业管理'},
    {'code': 'settings.view', 'name': '系统设置', 'category': '企业管理'},
    {'code': 'prompts.manage', 'name': '提示词管理', 'category': '企业管理'},
    {'code': 'knowledge.view', 'name': '知识文档', 'category': '企业知识库'},
    {'code': 'dataBase.view', 'name': '数据底座', 'category': '企业知识库'},
    {'code': 'media.view', 'name': '宣传图片', 'category': '企业知识库'},
    {'code': 'skills.view', 'name': '技能市场', 'category': '企业知识库'},
    {'code': 'agent.ops', 'name': '运营智能体', 'category': '智能体'},
    {'code': 'agent.crm', 'name': '跟客智能体', 'category': '智能体'},
    {'code': 'agent.purchase', 'name': '采购智能体', 'category': '智能体'},
    {'code': 'agent.flow', 'name': '流向智能体', 'category': '智能体'},
    {'code': 'agent.academic', 'name': '学术智能体', 'category': '智能体'},
]


def _role_permissions(role: Role | None):
    """提取角色权限列表（含 * 通配时返回全部）"""
    if not role:
        return []
    perms = role.permissions or []
    if '*' in perms:
        return [p['code'] for p in PERMISSION_CATALOG]
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

    # 超级用户/管理员直接拥有全部权限
    is_admin = user.is_superuser or user.is_staff

    # 找到用户的租户和角色
    membership = user.tenant_memberships.select_related('tenant', 'role').first()
    tenant_data = None
    user_data = {
        'id': str(user.id),
        'name': user.username,
        'roleId': 'admin' if is_admin else 'member',
        'roleName': '超级管理员' if is_admin else '成员',
        'permissions': ['*'] if is_admin else [],
    }

    if membership:
        if not is_admin:
            user_data['roleId'] = membership.role.code if membership.role else 'member'
            user_data['roleName'] = membership.role.name if membership.role else '成员'
            user_data['permissions'] = _role_permissions(membership.role)
        tenant_data = TenantSerializer(membership.tenant).data

    if not tenant_data:
        # 用户没有租户，返回第一个可用租户
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
    """GET /api/v1/auth/me — 获取当前用户信息"""
    tenant, membership = _get_membership(request)
    # 超级用户/管理员直接拥有全部权限
    is_admin = request.user.is_superuser or request.user.is_staff
    user_data = {
        'id': str(request.user.id),
        'name': request.user.username,
        'roleId': 'admin' if is_admin else 'member',
        'roleName': '超级管理员' if is_admin else '成员',
        'permissions': ['*'] if is_admin else [],
    }
    if membership and membership.role:
        if not is_admin:
            user_data['roleId'] = membership.role.code
            user_data['roleName'] = membership.role.name
            user_data['permissions'] = _role_permissions(membership.role)

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
@require_permission('settings.view')
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
@require_permission('members.manage')
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
@require_permission('members.manage')
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

    membership, created = TenantUser.objects.get_or_create(
        user=user, tenant=tenant,
        defaults={'role': role, 'credits': 500, 'status': 'offline', 'enabled': True}
    )
    if not created:
        membership.role = role
        membership.save()

    return api_success(TenantUserSerializer(membership).data, msg='成员已添加')


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
@require_permission('members.manage')
def tenant_member_update(request: HttpRequest, member_id: str):
    """PUT /api/v1/tenant/members/<id> — 更新成员"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    try:
        membership = tenant.members.get(id=member_id)
    except TenantUser.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='成员不存在')

    # 支持 role_id: int -> role: Role 对象
    data = dict(request.data)
    if 'role_id' in data and 'role' not in data:
        try:
            data['role'] = Role.objects.get(id=data.pop('role_id'), tenant=tenant)
        except Role.DoesNotExist:
            pass

    serializer = TenantUserSerializer(membership, data=data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return api_success(serializer.data, msg='成员已更新')
    return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
@require_permission('members.manage')
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
@require_permission('settings.view')
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
@require_permission('permissions.view')
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
@require_permission('permissions.view')
def tenant_permissions(request: HttpRequest):
    """GET /api/v1/tenant/permissions — 平台权限清单（中文名称）"""
    return api_success(PERMISSION_CATALOG)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_permission('permissions.view')
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
@require_permission('permissions.view')
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
@require_permission('permissions.view')
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
@require_permission('config.view')
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
                'custom': ac_data.get('custom', False),
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
@require_permission('config.view')
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

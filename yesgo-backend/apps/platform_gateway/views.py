"""
商户数据接入 API —— 第一层预留接口
对齐架构文档 v1.1：
  GET  /api/v1/platform/tenants            — 租户列表
  POST /api/v1/platform/tenants            — 创建租户（含分配智能体、绑定数据库、初始积分）
  GET  /api/v1/platform/tenants/<id>/credits/        — 获取租户积分余额 + 充值记录
  POST /api/v1/platform/tenants/<id>/credits/recharge/ — 积分充值
  GET  /api/v1/platform/tenants/<id>/agents/         — 获取租户已分配智能体
  PUT  /api/v1/platform/tenants/<id>/agents/         — 更新租户智能体分配
  POST /api/v1/platform/products/sync       — 商品同步
  POST /api/v1/platform/inventory/sync      — 库存同步
  POST /api/v1/platform/orders/sync         — 订单同步
  POST /api/v1/platform/customers/sync      — 客户同步
  POST /api/v1/platform/distribution/sync   — 流向同步

每个接口通过 X-Tenant-ID 标识来源商户，X-Platform-Key 鉴权
"""
from django.db import transaction
from django.http import HttpRequest
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from apps.platform.utils import api_success, api_error, API_CODE
from apps.platform.models import Tenant, Role, TenantUser, Agent, AgentConfig
from apps.platform.serializers import TenantSerializer, AgentSerializer, AgentConfigSerializer
from apps.tenant_ext.models import CreditLedger, DataConnector
from apps.tenant_ext.serializers import CreditLedgerSerializer
from apps.platform.sync_service import match_tenant_to_platforms


# ═══════════════════════════════════════════════════════════════════════════════
# 智能体标识符解析与数据底座绑定工具函数
# ═══════════════════════════════════════════════════════════════════════════════

def _resolve_agent_id(identifier: str) -> str | None:
    """将 agent_id 或 agent.code 统一解析为 agent_id。

    历史数据中 AgentConfig.agent_id 字段可能存储了 agent.code（如 'procurement'）
    而非 agent.agent_id（如 'purchase'），导致回收/分配时产生重复或残留。
    该函数优先按 agent_id 精确匹配，失败后再按 code 匹配。
    """
    if not identifier or not isinstance(identifier, str):
        return None
    identifier = identifier.strip()
    # 1) 优先按 agent_id 精确查找
    try:
        return Agent.objects.get(agent_id=identifier).agent_id
    except Agent.DoesNotExist:
        pass
    # 2) 再按 code 查找（code 非空且唯一）
    if identifier:
        try:
            agent = Agent.objects.get(code=identifier)
            if agent.code:
                return agent.agent_id
        except Agent.DoesNotExist:
            pass
    return None


def _build_agent_bindings(tenant: Tenant, agent_id: str) -> list[dict]:
    """构造某个租户智能体已绑定的数据底座列表（供前端编辑展示）。"""
    try:
        config = AgentConfig.objects.get(tenant=tenant, agent_id=agent_id)
    except AgentConfig.DoesNotExist:
        return []
    bound_ids = list(config.bound_data_bases or [])
    if not bound_ids:
        return []
    connectors = DataConnector.objects.filter(id__in=bound_ids, tenant=tenant)
    return [
        {
            'id': c.id,
            'name': c.name,
            'type': c.type,
            'description': c.description,
            'api_url': (c.config or {}).get('api_url', ''),
            'api_key': (c.config or {}).get('api_key', ''),
        }
        for c in connectors
    ]


def _apply_database_bindings(tenant: Tenant, agent_id: str, bindings: list) -> None:
    """为指定租户智能体应用数据底座绑定（编辑时用）。

    策略：以传入的 bindings 为准，删除该智能体下旧的、非平台同步的 DataConnector，
    并重新创建新的 DataConnector，同时更新 AgentConfig.bound_data_bases。
    """
    try:
        config = AgentConfig.objects.get(tenant=tenant, agent_id=agent_id)
    except AgentConfig.DoesNotExist:
        return

    # 保留平台同步自动创建的 connector（platform_enterprise 非空）
    old_bound_ids = set(config.bound_data_bases or [])
    old_platform_ids = set(
        DataConnector.objects.filter(
            id__in=old_bound_ids, tenant=tenant
        ).exclude(platform_enterprise__isnull=True).values_list('id', flat=True)
    )
    # 删除旧的非平台同步 connector
    DataConnector.objects.filter(
        id__in=old_bound_ids - old_platform_ids, tenant=tenant
    ).delete()

    new_bound_ids = list(old_platform_ids)
    for binding in bindings:
        if not isinstance(binding, dict):
            continue
        name = str(binding.get('name', '')).strip()
        if not name:
            continue
        connector = DataConnector.objects.create(
            tenant=tenant,
            name=name,
            type=binding.get('type', 'erp'),
            description=str(binding.get('description', '')).strip(),
            icon_name=binding.get('icon_name', 'Database'),
            enabled=binding.get('enabled', True),
            status='pending',
            config=binding.get('config', {}),
        )
        new_bound_ids.append(connector.id)

    config.bound_data_bases = new_bound_ids
    config.save(update_fields=['bound_data_bases'])


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def tenants_list(request: HttpRequest):
    """GET|POST /api/v1/platform/tenants — 租户列表/创建

    POST 参数：
      - code: 租户编码（必填）
      - name: 租户名称（必填）
      - platform_name: 平台名称（必填）
      - enterprise_id: 企业ID（统一社会信用代码）
      - admin_username: 租户管理员账号（默认 admin）
      - admin_password: 租户管理员密码（默认 admin123）
      - admin_phone: 租户管理员手机号（必填）
      - initial_credits: 初始积分余额（默认 0）
      - agent_codes: 分配的智能体ID列表（如 ['agent_ops', 'agent_crm']）
      - database_bindings: 智能体数据库API绑定（如 {'agent_ops': [{'name': 'ERP', 'type': 'erp', 'config': {...}}]}）
    """
    if request.method == 'GET':
        tenants = Tenant.objects.all().order_by('-created_at')
        data = TenantSerializer(tenants, many=True).data
        return api_success({'tenants': data})

    # POST — 创建租户 + 租户管理员 + 分配智能体 + 绑定数据库
    data = request.data
    admin_username = data.get('admin_username', 'admin')
    admin_password = data.get('admin_password', 'admin123')
    admin_phone = data.get('admin_phone', '').strip()
    enterprise_id = data.get('enterprise_id', '').strip()
    initial_credits = data.get('initial_credits', 0)
    agent_codes = data.get('agent_codes', [])
    database_bindings = data.get('database_bindings', {})

    # 校验
    if not admin_username or not admin_password:
        return api_error(code=API_CODE.BAD_REQUEST, msg='管理员账号和密码不能为空')
    if not admin_phone:
        return api_error(code=API_CODE.BAD_REQUEST, msg='管理员手机号不能为空')
    if User.objects.filter(username=admin_username).exists():
        return api_error(code=API_CODE.BAD_REQUEST, msg=f'用户名 {admin_username} 已存在')

    # 从 data 中提取非模型字段，避免序列化器验证失败
    tenant_data = {
        'code': data.get('code', ''),
        'name': data.get('name', ''),
        'platform_name': data.get('platform_name', ''),
        'enterprise_id': data.get('enterprise_id', ''),
        'status': data.get('status', 'active'),
    }

    serializer = TenantSerializer(data=tenant_data)
    if not serializer.is_valid():
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))

    try:
        with transaction.atomic():
            tenant = serializer.save(
                created_by=request.user,
                credits=int(initial_credits) if initial_credits else 0,
            )

            # 创建租户管理员角色（全部权限）
            admin_role = Role.objects.create(
                tenant=tenant,
                name='租户管理员',
                code='admin',
                description='租户内最高权限，可管理成员、配置和数据',
                permissions=['*'],
                can_manage_members=True,
                can_assign_credits=True,
            )

            # 创建租户管理员用户
            user = User.objects.create_user(
                username=admin_username,
                password=admin_password,
            )

            # 绑定为租户成员
            TenantUser.objects.create(
                user=user,
                tenant=tenant,
                role=admin_role,
                phone=admin_phone,
            )

            # 为租户分配智能体（创建 AgentConfig 记录）
            assigned_agents = []
            resolved_map = {}
            if agent_codes and isinstance(agent_codes, list):
                for raw_id in agent_codes:
                    resolved_id = _resolve_agent_id(raw_id)
                    if not resolved_id:
                        continue
                    resolved_map[raw_id] = resolved_id
                    # 创建 AgentConfig（如果已存在则跳过）
                    config, created = AgentConfig.objects.get_or_create(
                        tenant=tenant,
                        agent_id=resolved_id,
                        defaults={
                            'model_id': '',
                            'temperature': 0.7,
                            'custom': {},
                        }
                    )
                    assigned_agents.append(resolved_id)

                # 为每个智能体绑定租户私有数据库 API（如果提供了 database_bindings）
                for raw_id, bindings in database_bindings.items():
                    resolved_id = resolved_map.get(raw_id) or _resolve_agent_id(raw_id)
                    if not resolved_id or resolved_id not in assigned_agents:
                        continue
                    if not isinstance(bindings, list):
                        continue
                    _apply_database_bindings(tenant, resolved_id, bindings)

            # 记录初始积分充值
            if initial_credits and int(initial_credits) > 0:
                CreditLedger.objects.create(
                    tenant=tenant,
                    user=user,
                    agent_code='system',
                    agent_name='系统充值',
                    amount=-int(initial_credits),
                    reason='租户创建初始积分',
                    balance_after=int(initial_credits),
                )
    except Exception as e:
        return api_error(code=API_CODE.INTERNAL_ERROR, msg=f'创建租户失败: {str(e)}')

    # 租户创建成功后，自动匹配所有平台的 PlatformEnterprise
    match_result = match_tenant_to_platforms(tenant) if enterprise_id else None

    return api_success({
        **TenantSerializer(tenant).data,
        'admin_username': admin_username,
        'assigned_agents': assigned_agents,
        'match_result': match_result,
    }, msg='租户已创建，管理员账号已生成')
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def tenant_credits(request: HttpRequest, tenant_id: str):
    """GET /api/v1/platform/tenants/<id>/credits/ — 获取租户积分余额 + 充值记录
    POST /api/v1/platform/tenants/<id>/credits/recharge/ — 积分充值
    """
    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='租户不存在')

    if request.method == 'POST':
        # 充值
        amount = request.data.get('amount', 0)
        reason = request.data.get('reason', '管理员充值')

        try:
            amount = int(amount)
        except (ValueError, TypeError):
            return api_error(code=API_CODE.BAD_REQUEST, msg='充值金额必须为正整数')

        if amount <= 0:
            return api_error(code=API_CODE.BAD_REQUEST, msg='充值金额必须为正整数')

        tenant.credits += amount
        tenant.save()

        # 记录账本（找到租户管理员记录，如果没有则用当前请求用户）
        target_user = None
        admin_membership = tenant.members.filter(role__code='admin').first()
        if admin_membership:
            target_user = admin_membership.user
        elif request.user.is_authenticated:
            target_user = request.user

        entry = CreditLedger.objects.create(
            tenant=tenant,
            user=target_user,
            agent_code='system',
            agent_name='系统充值',
            amount=-amount,
            reason=reason,
            balance_after=tenant.credits,
        )

        return api_success({
            'balance': tenant.credits,
            'entry': CreditLedgerSerializer(entry).data,
        }, msg=f'充值成功，当前余额：{tenant.credits}')

    # GET — 返回余额 + 充值记录
    ledger = tenant.credit_ledger.all().order_by('-created_at')[:50]
    return api_success({
        'balance': tenant.credits,
        'ledger': CreditLedgerSerializer(ledger, many=True).data,
    })


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def tenant_agents(request: HttpRequest, tenant_id: str):
    """GET /api/v1/platform/tenants/<id>/agents/ — 获取租户已分配智能体 + 可用智能体列表
    PUT /api/v1/platform/tenants/<id>/agents/ — 更新租户智能体分配

    PUT body: {
        agent_codes: ['agent_ops', 'agent_crm'],
        database_bindings: {          // 可选
            'agent_ops': [{'name':'ERP','type':'erp','config':{'api_url':'...','api_key':'...'}}]
        }
    }
    """
    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='租户不存在')

    if request.method == 'PUT':
        agent_codes = request.data.get('agent_codes', [])
        database_bindings = request.data.get('database_bindings', {}) or {}
        if not isinstance(agent_codes, list):
            return api_error(code=API_CODE.BAD_REQUEST, msg='agent_codes 必须为数组')
        if not isinstance(database_bindings, dict):
            return api_error(code=API_CODE.BAD_REQUEST, msg='database_bindings 必须为对象')

        with transaction.atomic():
            # 1) 将传入的标识符统一解析为 agent_id
            resolved_map = {}
            for raw_id in agent_codes:
                resolved = _resolve_agent_id(raw_id)
                if resolved:
                    resolved_map[raw_id] = resolved

            new_agent_ids = set(resolved_map.values())

            # 2) 清理历史脏数据：AgentConfig.agent_id 既非有效 agent_id 也非有效 code 的记录
            current_raw_ids = list(tenant.agent_configs.values_list('agent_id', flat=True))
            for raw_id in current_raw_ids:
                if _resolve_agent_id(raw_id) is None:
                    tenant.agent_configs.filter(agent_id=raw_id).delete()

            # 3) 获取当前有效的 agent_id 集合
            current_ids = set(tenant.agent_configs.values_list('agent_id', flat=True))

            # 4) 删除不再分配的
            to_remove = current_ids - new_agent_ids
            if to_remove:
                tenant.agent_configs.filter(agent_id__in=to_remove).delete()

            # 5) 新增分配的
            to_add = new_agent_ids - current_ids
            for agent_id in to_add:
                AgentConfig.objects.create(
                    tenant=tenant,
                    agent_id=agent_id,
                    model_id='',
                    temperature=0.7,
                    custom={},
                )

            # 6) 应用数据底座绑定（仅对已分配的智能体）
            for raw_id, bindings in database_bindings.items():
                resolved_id = resolved_map.get(raw_id) or _resolve_agent_id(raw_id)
                if not resolved_id or resolved_id not in new_agent_ids:
                    continue
                if not isinstance(bindings, list):
                    continue
                _apply_database_bindings(tenant, resolved_id, bindings)

        # 返回更新后的列表
        assigned = list(tenant.agent_configs.values_list('agent_id', flat=True))
        all_agents = Agent.objects.filter(enabled=True).order_by('sort_order', 'id')
        bindings_data = {
            agent_id: _build_agent_bindings(tenant, agent_id)
            for agent_id in assigned
        }
        return api_success({
            'assigned': assigned,
            'available': AgentSerializer(all_agents, many=True).data,
            'bindings': bindings_data,
        }, msg='智能体分配已更新')

    # GET — 返回已分配 + 可用列表 + 数据底座绑定
    assigned = list(tenant.agent_configs.values_list('agent_id', flat=True))
    all_agents = Agent.objects.filter(enabled=True).order_by('sort_order', 'id')
    bindings_data = {
        agent_id: _build_agent_bindings(tenant, agent_id)
        for agent_id in assigned
    }
    return api_success({
        'assigned': assigned,
        'available': AgentSerializer(all_agents, many=True).data,
        'bindings': bindings_data,
    })


@api_view(['POST'])
def sync_products(request: HttpRequest):
    """POST /api/v1/platform/products/sync — 商品同步"""
    tenant_id = getattr(request, 'tenant_id', '')
    data = request.data if hasattr(request, 'data') else {}
    items = data.get('items', [])
    return api_success({
        'tenantId': tenant_id,
        'synced': len(items),
        'msg': f'已同步 {len(items)} 条商品数据',
    })


@api_view(['POST'])
def sync_inventory(request: HttpRequest):
    """POST /api/v1/platform/inventory/sync — 库存同步"""
    tenant_id = getattr(request, 'tenant_id', '')
    data = request.data if hasattr(request, 'data') else {}
    items = data.get('items', [])
    return api_success({
        'tenantId': tenant_id,
        'synced': len(items),
        'msg': f'已同步 {len(items)} 条库存数据',
    })


@api_view(['POST'])
def sync_orders(request: HttpRequest):
    """POST /api/v1/platform/orders/sync — 订单同步"""
    tenant_id = getattr(request, 'tenant_id', '')
    data = request.data if hasattr(request, 'data') else {}
    items = data.get('items', [])
    return api_success({
        'tenantId': tenant_id,
        'synced': len(items),
        'msg': f'已同步 {len(items)} 条订单数据',
    })


@api_view(['POST'])
def sync_customers(request: HttpRequest):
    """POST /api/v1/platform/customers/sync — 客户同步"""
    tenant_id = getattr(request, 'tenant_id', '')
    data = request.data if hasattr(request, 'data') else {}
    items = data.get('items', [])
    return api_success({
        'tenantId': tenant_id,
        'synced': len(items),
        'msg': f'已同步 {len(items)} 条客户数据',
    })


@api_view(['POST'])
def sync_distribution(request: HttpRequest):
    """POST /api/v1/platform/distribution/sync — 流向同步"""
    tenant_id = getattr(request, 'tenant_id', '')
    data = request.data if hasattr(request, 'data') else {}
    items = data.get('items', [])
    return api_success({
        'tenantId': tenant_id,
        'synced': len(items),
        'msg': f'已同步 {len(items)} 条流向数据',
    })

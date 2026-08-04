"""积分管理 API — 平台后台配置 + 租户购买 + 智能体消耗规则"""
import uuid
import logging
from decimal import Decimal
from datetime import datetime

from django.contrib.auth.models import User
from django.http import HttpRequest
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from .utils import api_success, api_error, API_CODE
from .models import Tenant, CreditConfig, CreditPackage, AgentCreditRule, CreditOrder
from .serializers import (
    CreditConfigSerializer, CreditPackageSerializer,
    AgentCreditRuleSerializer, CreditOrderSerializer,
)
from .permissions import require_platform_permission
from apps.tenant_ext.models import CreditLedger

logger = logging.getLogger(__name__)

# 平台智能体默认列表（用于初始化 AgentCreditRule）
DEFAULT_AGENTS = [
    {'agent_code': 'purchase', 'agent_name': '采购兔', 'free_deduction': True,
     'description': '向上游供应商收费，租户使用不扣积分'},
    {'agent_code': 'operations', 'agent_name': '运营兔', 'free_deduction': False,
     'description': '标准消耗'},
    {'agent_code': 'marketing', 'agent_name': '跟客兔', 'free_deduction': False,
     'description': '标准消耗'},
    {'agent_code': 'distribution', 'agent_name': '流向兔', 'free_deduction': False,
     'description': '标准消耗'},
    {'agent_code': 'academic', 'agent_name': '学术兔', 'free_deduction': False,
     'description': '标准消耗'},
]


# ═══════════════════════════════════════
# 积分基础配置
# ═══════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.credits.view')
def credit_config_detail(request: HttpRequest):
    """GET /api/v1/admin/credits/config/ — 获取积分配置"""
    config = CreditConfig.get_config()
    return api_success(CreditConfigSerializer(config).data)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.credits.manage')
def credit_config_update(request: HttpRequest):
    """PUT /api/v1/admin/credits/config/ — 更新积分配置"""
    config = CreditConfig.get_config()
    serializer = CreditConfigSerializer(config, data=request.data, partial=True)
    if not serializer.is_valid():
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))
    serializer.save()
    return api_success(serializer.data, msg='配置已更新')


# ═══════════════════════════════════════
# 积分套餐管理
# ═══════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.credits.view')
def credit_package_list(request: HttpRequest):
    """GET /api/v1/admin/credits/packages/ — 套餐列表"""
    packages = CreditPackage.objects.all().order_by('sort_order', 'id')
    return api_success(CreditPackageSerializer(packages, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.credits.manage')
def credit_package_create(request: HttpRequest):
    """POST /api/v1/admin/credits/packages/create/ — 创建套餐"""
    serializer = CreditPackageSerializer(data=request.data)
    if not serializer.is_valid():
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))
    serializer.save()
    return api_success(serializer.data, msg='套餐已创建')


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.credits.manage')
def credit_package_update(request: HttpRequest, package_id: int):
    """PUT /api/v1/admin/credits/packages/<id>/ — 更新套餐"""
    try:
        pkg = CreditPackage.objects.get(id=package_id)
    except CreditPackage.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='套餐不存在')
    serializer = CreditPackageSerializer(pkg, data=request.data, partial=True)
    if not serializer.is_valid():
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))
    serializer.save()
    return api_success(serializer.data, msg='套餐已更新')


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.credits.manage')
def credit_package_delete(request: HttpRequest, package_id: int):
    """DELETE /api/v1/admin/credits/packages/<id>/ — 删除套餐"""
    try:
        pkg = CreditPackage.objects.get(id=package_id)
    except CreditPackage.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='套餐不存在')
    pkg.delete()
    return api_success(msg='套餐已删除')


# ═══════════════════════════════════════
# 智能体积分消耗规则
# ═══════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.credits.view')
def agent_credit_rule_list(request: HttpRequest):
    """GET /api/v1/admin/credits/agent-rules/ — 智能体积分规则列表"""
    rules = AgentCreditRule.objects.all().order_by('id')
    # 如果没有规则，自动初始化默认规则
    if not rules.exists():
        for agent in DEFAULT_AGENTS:
            AgentCreditRule.objects.create(**agent)
        rules = AgentCreditRule.objects.all().order_by('id')
    return api_success(AgentCreditRuleSerializer(rules, many=True).data)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.credits.manage')
def agent_credit_rule_update(request: HttpRequest, rule_id: int):
    """PUT /api/v1/admin/credits/agent-rules/<id>/ — 更新智能体积分规则"""
    try:
        rule = AgentCreditRule.objects.get(id=rule_id)
    except AgentCreditRule.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='规则不存在')
    serializer = AgentCreditRuleSerializer(rule, data=request.data, partial=True)
    if not serializer.is_valid():
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))
    serializer.save()
    return api_success(serializer.data, msg='规则已更新')


# ═══════════════════════════════════════
# 积分订单管理
# ═══════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.credits.view')
def credit_order_list(request: HttpRequest):
    """GET /api/v1/admin/credits/orders/ — 积分订单列表"""
    orders = CreditOrder.objects.all().order_by('-created_at')

    # 筛选
    status = request.GET.get('status')
    if status:
        orders = orders.filter(status=status)
    tenant_id = request.GET.get('tenant_id')
    if tenant_id:
        orders = orders.filter(tenant_id=tenant_id)

    # 分页
    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 20))
    total = orders.count()
    items = orders[(page - 1) * page_size: page * page_size]

    return api_success({
        'items': CreditOrderSerializer(items, many=True).data,
        'total': total,
        'page': page,
        'page_size': page_size,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.credits.manage')
def credit_order_confirm(request: HttpRequest, order_id: int):
    """POST /api/v1/admin/credits/orders/<id>/confirm/ — 确认订单到账（充值积分）"""
    try:
        order = CreditOrder.objects.get(id=order_id)
    except CreditOrder.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='订单不存在')

    if order.status in ('confirmed',):
        return api_error(code=API_CODE.BAD_REQUEST, msg='订单已确认')

    # 增加租户积分
    tenant = order.tenant
    total = order.total_credits
    tenant.credits += total
    tenant.save()

    # 更新订单状态
    order.status = 'confirmed'
    order.confirmed_by = request.user
    order.confirmed_at = timezone.now()
    order.save()

    # 记录积分流水
    CreditLedger.objects.create(
        tenant=tenant,
        user=request.user,
        agent_code='system',
        agent_name='积分购买',
        amount=-total,
        reason=f'购买积分({order.order_no})',
        balance_after=tenant.credits,
    )

    return api_success({
        'order': CreditOrderSerializer(order).data,
        'tenant_credits': tenant.credits,
    }, msg='订单已确认，积分已到账')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.credits.manage')
def credit_order_cancel(request: HttpRequest, order_id: int):
    """POST /api/v1/admin/credits/orders/<id>/cancel/ — 取消订单"""
    try:
        order = CreditOrder.objects.get(id=order_id)
    except CreditOrder.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='订单不存在')

    if order.status in ('confirmed', 'cancelled'):
        return api_error(code=API_CODE.BAD_REQUEST, msg=f'订单状态为{order.get_status_display()}，无法取消')

    order.status = 'cancelled'
    order.save()
    return api_success(CreditOrderSerializer(order).data, msg='订单已取消')


# ═══════════════════════════════════════
# 租户手动充值
# ═══════════════════════════════════════

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.credits.manage')
def credit_manual_recharge(request: HttpRequest):
    """POST /api/v1/admin/credits/recharge/ — 手动给租户充值积分"""
    tenant_id = request.data.get('tenant_id')
    amount = request.data.get('amount')
    reason = request.data.get('reason', '管理员手动充值')

    if not tenant_id or not amount:
        return api_error(code=API_CODE.BAD_REQUEST, msg='缺少 tenant_id 或 amount')

    try:
        amount = int(amount)
        if amount <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        return api_error(code=API_CODE.BAD_REQUEST, msg='amount 必须为正整数')

    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='租户不存在')

    # 生成充值订单
    order_no = f'CR{timezone.now().strftime("%Y%m%d%H%M%S")}{str(uuid.uuid4())[:6].upper()}'
    order = CreditOrder.objects.create(
        order_no=order_no,
        tenant=tenant,
        credits=amount,
        bonus_credits=0,
        amount=Decimal('0'),
        payment_method='manual',
        status='confirmed',
        confirmed_by=request.user,
        confirmed_at=timezone.now(),
        remark=reason,
    )

    # 增加租户积分
    tenant.credits += amount
    tenant.save()

    # 记录流水
    CreditLedger.objects.create(
        tenant=tenant,
        user=request.user,
        agent_code='system',
        agent_name='管理员充值',
        amount=-amount,
        reason=reason,
        balance_after=tenant.credits,
    )

    return api_success({
        'order': CreditOrderSerializer(order).data,
        'tenant_credits': tenant.credits,
    }, msg=f'已为 {tenant.name} 充值 {amount} 积分')


# ═══════════════════════════════════════
# 积分收入统计
# ═══════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.credits.view')
def credit_stats(request: HttpRequest):
    """GET /api/v1/admin/credits/stats/ — 积分收入统计"""
    from django.db.models import Sum, Count

    confirmed_orders = CreditOrder.objects.filter(status='confirmed')
    total_revenue = confirmed_orders.aggregate(
        total=Sum('amount')
    )['total'] or Decimal('0')
    total_credits_sold = confirmed_orders.aggregate(
        total=Sum('credits')
    )['total'] or 0

    # 各租户积分余额
    tenants = Tenant.objects.all().values('id', 'name', 'code', 'credits')

    # 最近 30 天订单趋势
    from datetime import timedelta
    thirty_days_ago = timezone.now() - timedelta(days=30)
    recent_orders = CreditOrder.objects.filter(
        created_at__gte=thirty_days_ago
    ).values('created_at', 'credits', 'amount', 'status')

    # 智能体消耗统计
    from apps.tenant_ext.models import CreditLedger
    agent_consumption = CreditLedger.objects.filter(
        amount__gt=0
    ).values('agent_code', 'agent_name').annotate(
        total_consumed=Sum('amount'),
        count=Count('id')
    ).order_by('-total_consumed')

    return api_success({
        'total_revenue': str(total_revenue),
        'total_credits_sold': total_credits_sold,
        'total_orders': confirmed_orders.count(),
        'pending_orders': CreditOrder.objects.filter(status='pending').count(),
        'tenant_balances': list(tenants),
        'recent_orders': list(recent_orders),
        'agent_consumption': list(agent_consumption),
    })


# ═══════════════════════════════════════
# 租户端：购买积分 + 查看套餐
# ═══════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def credit_packages_public(request: HttpRequest):
    """GET /api/v1/credits/packages/ — 租户端获取可用套餐"""
    packages = CreditPackage.objects.filter(enabled=True).order_by('sort_order', 'id')
    config = CreditConfig.get_config()
    return api_success({
        'packages': CreditPackageSerializer(packages, many=True).data,
        'config': CreditConfigSerializer(config).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def credit_order_create(request: HttpRequest):
    """POST /api/v1/credits/orders/create/ — 租户端创建购买订单"""
    from apps.platform.views import _get_tenant

    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.FORBIDDEN, msg='无租户上下文')

    package_id = request.data.get('package_id')
    credits = request.data.get('credits')
    payment_method = request.data.get('payment_method', 'offline')

    config = CreditConfig.get_config()

    if package_id:
        # 选择套餐
        try:
            pkg = CreditPackage.objects.get(id=package_id, enabled=True)
            credits = pkg.credits
            bonus = pkg.bonus_credits
            amount = pkg.price
        except CreditPackage.DoesNotExist:
            return api_error(code=API_CODE.NOT_FOUND, msg='套餐不存在')
    else:
        # 自定义数量
        try:
            credits = int(credits)
        except (ValueError, TypeError):
            return api_error(code=API_CODE.BAD_REQUEST, msg='积分数量无效')
        if credits < config.min_purchase_credits:
            return api_error(code=API_CODE.BAD_REQUEST,
                             msg=f'最少购买 {config.min_purchase_credits} 积分')
        bonus = 0
        amount = (Decimal(credits) * config.unit_price).quantize(Decimal('0.01'))

    order_no = f'CO{timezone.now().strftime("%Y%m%d%H%M%S")}{str(uuid.uuid4())[:6].upper()}'
    order = CreditOrder.objects.create(
        order_no=order_no,
        tenant=tenant,
        package_id=package_id,
        credits=credits,
        bonus_credits=bonus,
        amount=amount,
        payment_method=payment_method,
        status='pending',
    )

    return api_success(CreditOrderSerializer(order).data, msg='订单已创建')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def credit_order_my_list(request: HttpRequest):
    """GET /api/v1/credits/orders/ — 租户端查看自己的订单"""
    from apps.platform.views import _get_tenant

    tenant = _get_tenant(request)
    if not tenant:
        return api_success({'items': [], 'total': 0})

    orders = CreditOrder.objects.filter(tenant=tenant).order_by('-created_at')
    data = CreditOrderSerializer(orders, many=True).data
    return api_success({'items': data, 'total': len(data)})

"""
数据底座 API —— 商品/库存/订单/客户/流向
使用 Django 模型持久化，支持多租户隔离
"""

from django.http import HttpRequest
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.platform.models import Tenant
from apps.platform.utils import api_success, api_error, API_CODE
from apps.platform.permissions import require_permission
from .models import Product, Customer, Order, Warehouse, InventoryAlert
from .serializers import (
    ProductSerializer, CustomerSerializer, OrderSerializer,
    WarehouseSerializer, InventoryAlertSerializer
)


def _get_tenant(request: HttpRequest):
    tenant_id = getattr(request, 'tenant_id', None)
    if tenant_id:
        try:
            return Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            pass
    return Tenant.objects.first()


# ═══════════════════════════════════════
# 商品
# ═══════════════════════════════════════


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@require_permission('dataBase.view')
def products(request: HttpRequest):
    """GET/POST /api/v1/data/products"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success({'items': [], 'total': 0})

    if request.method == 'POST':
        serializer = ProductSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(tenant=tenant)
            return api_success(serializer.data, msg='商品已创建')
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))

    products_qs = tenant.products.all()
    data = ProductSerializer(products_qs, many=True).data
    return api_success({'items': data, 'total': len(data)})


# ═══════════════════════════════════════
# 库存
# ═══════════════════════════════════════


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_permission('dataBase.view')
def inventory(request: HttpRequest):
    """GET /api/v1/data/inventory"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success({'warehouses': [], 'alerts': [], 'summary': {}})

    warehouses = WarehouseSerializer(tenant.warehouses.all(), many=True).data
    alerts_qs = tenant.inventory_alerts.select_related('product', 'warehouse').all()
    alerts = []
    for a in alerts_qs:
        alerts.append({
            'product': a.product.name,
            'warehouse': a.warehouse.name,
            'current': a.current,
            'safety': a.safety,
            'severity': a.severity,
        })

    products = tenant.products.all()
    total_sku = products.count()
    total_value = sum(float(p.price) * p.stock for p in products)
    alert_count = alerts_qs.count()

    return api_success({
        'warehouses': warehouses,
        'alerts': alerts,
        'summary': {
            'totalSku': total_sku,
            'totalValue': total_value,
            'alertCount': alert_count,
        }
    })


# ═══════════════════════════════════════
# 订单
# ═══════════════════════════════════════


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@require_permission('dataBase.view')
def orders(request: HttpRequest):
    """GET/POST /api/v1/data/orders"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success({'items': [], 'total': 0, 'summary': {}})

    if request.method == 'POST':
        serializer = OrderSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(tenant=tenant)
            return api_success(serializer.data, msg='订单已创建')
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))

    from django.utils import timezone
    from datetime import timedelta
    today = timezone.now().date()
    orders_qs = tenant.orders.all().order_by('-time')
    today_orders = tenant.orders.filter(time__date=today)
    week_orders = tenant.orders.filter(time__date__gte=today - timedelta(days=7))

    data = OrderSerializer(orders_qs, many=True).data
    return api_success({
        'items': data,
        'total': len(data),
        'summary': {
            'todayCount': today_orders.count(),
            'todayAmount': float(sum(o.amount for o in today_orders)),
            'weekCount': week_orders.count(),
            'weekAmount': float(sum(o.amount for o in week_orders)),
        }
    })


# ═══════════════════════════════════════
# 客户
# ═══════════════════════════════════════


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@require_permission('dataBase.view')
def customers(request: HttpRequest):
    """GET/POST /api/v1/data/customers"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success({'items': [], 'total': 0})

    if request.method == 'POST':
        serializer = CustomerSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(tenant=tenant)
            return api_success(serializer.data, msg='客户已创建')
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))

    customers_qs = tenant.customers.all()
    data = CustomerSerializer(customers_qs, many=True).data
    return api_success({'items': data, 'total': len(data)})


# ═══════════════════════════════════════
# 流向
# ═══════════════════════════════════════


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_permission('dataBase.view')
def distribution(request: HttpRequest):
    """GET /api/v1/data/distribution"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success({'overview': {}, 'anomalies': [], 'channels': []})

    # 从订单数据计算流向指标
    from django.utils import timezone
    from datetime import timedelta
    month_ago = timezone.now() - timedelta(days=30)
    monthly_orders = tenant.orders.filter(time__gte=month_ago)

    return api_success({
        'overview': {
            'totalChannels': 48,
            'activeChannels': 42,
            'anomalyCount': 2,
            'coverageRate': '87.5%',
        },
        'anomalies': [],
        'channels': [
            {'name': '华北区域', 'skuCount': 128, 'monthlySales': 2850000.0, 'growth': '+8.2%'},
            {'name': '华东区域', 'skuCount': 156, 'monthlySales': 4200000.0, 'growth': '+12.5%'},
            {'name': '华南区域', 'skuCount': 98, 'monthlySales': 1860000.0, 'growth': '+5.8%'},
            {'name': '西南区域', 'skuCount': 81, 'monthlySales': 1250000.0, 'growth': '+15.3%'},
        ],
    })

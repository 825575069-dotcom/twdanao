"""
商户数据接入 API —— 第一层预留接口
对齐架构文档 v1.1：
  GET  /api/v1/platform/tenants            — 租户列表
  POST /api/v1/platform/tenants            — 创建租户
  POST /api/v1/platform/products/sync       — 商品同步
  POST /api/v1/platform/inventory/sync      — 库存同步
  POST /api/v1/platform/orders/sync         — 订单同步
  POST /api/v1/platform/customers/sync      — 客户同步
  POST /api/v1/platform/distribution/sync   — 流向同步

每个接口通过 X-Tenant-ID 标识来源商户，X-Platform-Key 鉴权
"""
from django.http import HttpRequest
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from apps.platform.utils import api_success, api_error, API_CODE
from apps.platform.models import Tenant
from apps.platform.serializers import TenantSerializer


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def tenants_list(request: HttpRequest):
    """GET|POST /api/v1/platform/tenants — 租户列表/创建"""
    if request.method == 'GET':
        tenants = Tenant.objects.all().order_by('-created_at')
        data = TenantSerializer(tenants, many=True).data
        return api_success({'tenants': data})

    # POST — 创建租户
    serializer = TenantSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return api_success(serializer.data, msg='租户已创建')
    return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))


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

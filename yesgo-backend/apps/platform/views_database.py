"""平台数据库视图 — CRUD + 同步 + 匹配预览"""
from django.http import HttpRequest
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from .utils import api_success, api_error, API_CODE
from .models import PlatformDatabase, PlatformEnterprise, Tenant
from .serializers import PlatformDatabaseSerializer, PlatformEnterpriseSerializer
from .sync_service import sync_platform_enterprises, match_tenant_to_platforms


# ═══════════════════════════════════════
# 平台数据库 CRUD
# ═══════════════════════════════════════

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def platform_database_list(request: HttpRequest):
    """GET /api/v1/platform-databases/ — 平台数据库列表
    POST /api/v1/platform-databases/ — 创建平台数据库
    """
    if request.method == 'GET':
        qs = PlatformDatabase.objects.all().order_by('sort_order', 'id')
        data = PlatformDatabaseSerializer(qs, many=True).data
        return api_success({'databases': data})

    # POST — 创建
    data = request.data
    serializer = PlatformDatabaseSerializer(data=data)
    if not serializer.is_valid():
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))

    code = serializer.validated_data.get('code', '')
    if PlatformDatabase.objects.filter(code=code).exists():
        return api_error(code=API_CODE.BAD_REQUEST, msg=f'平台编码 {code} 已存在')

    obj = serializer.save()
    return api_success(PlatformDatabaseSerializer(obj).data, msg='平台数据库已创建')


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def platform_database_detail(request: HttpRequest, pk: int):
    """GET|PUT|DELETE /api/v1/platform-databases/<pk>/"""
    try:
        obj = PlatformDatabase.objects.get(pk=pk)
    except PlatformDatabase.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='平台数据库不存在')

    if request.method == 'GET':
        # 返回详情 + 企业列表
        data = PlatformDatabaseSerializer(obj).data
        enterprises = PlatformEnterpriseSerializer(
            obj.enterprises.all().order_by('enterprise_name'), many=True
        ).data
        data['enterprises'] = enterprises
        return api_success(data)

    if request.method == 'DELETE':
        obj.delete()
        return api_success(msg='已删除')

    # PUT — 更新
    serializer = PlatformDatabaseSerializer(obj, data=request.data, partial=True)
    if not serializer.is_valid():
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))
    serializer.save()
    return api_success(PlatformDatabaseSerializer(serializer.instance).data, msg='已更新')


# ═══════════════════════════════════════
# 同步
# ═══════════════════════════════════════

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def platform_database_sync(request: HttpRequest, pk: int):
    """POST /api/v1/platform-databases/<pk>/sync/ — 从 SaaS 平台同步企业列表"""
    try:
        obj = PlatformDatabase.objects.get(pk=pk)
    except PlatformDatabase.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='平台数据库不存在')

    if not obj.sync_enabled:
        return api_error(code=API_CODE.BAD_REQUEST, msg='该平台同步已禁用')

    result = sync_platform_enterprises(obj)

    if result['success']:
        return api_success(result, msg=f'同步成功：共 {result["total"]} 家企业，匹配 {result["matched"]} 家租户')
    else:
        return api_error(code=API_CODE.INTERNAL_ERROR, msg=f'同步失败: {result["error"]}', data=result)


# ═══════════════════════════════════════
# 匹配预览
# ═══════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def match_preview(request: HttpRequest):
    """GET /api/v1/platform-databases/match-preview/ — 全局匹配预览

    返回所有平台企业的匹配状态，供前端展示匹配结果。
    """
    enterprises = PlatformEnterprise.objects.select_related(
        'platform_database', 'matched_tenant'
    ).all().order_by('platform_database__sort_order', 'enterprise_name')

    data = PlatformEnterpriseSerializer(enterprises, many=True).data

    # 汇总
    total = len(data)
    matched = sum(1 for e in data if e.get('matched_tenant'))
    unmatched = total - matched

    return api_success({
        'enterprises': data,
        'total': total,
        'matched': matched,
        'unmatched': unmatched,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def match_tenant(request: HttpRequest, enterprise_pk: int):
    """POST /api/v1/platform-databases/enterprises/<pk>/match/ — 手动匹配/重新匹配

    Body: { "tenant_id": 123 }  或 { "enterprise_id": "统一社会信用代码" }
    """
    ent = None
    try:
        ent = PlatformEnterprise.objects.get(pk=enterprise_pk)
    except PlatformEnterprise.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='平台企业不存在')

    tenant_id = request.data.get('tenant_id')
    enterprise_id = request.data.get('enterprise_id', ent.enterprise_id)

    # 优先用 tenant_id 直接匹配
    tenant = None
    if tenant_id:
        try:
            tenant = Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            return api_error(code=API_CODE.NOT_FOUND, msg='租户不存在')
    elif enterprise_id:
        try:
            tenant = Tenant.objects.get(enterprise_id=enterprise_id)
        except Tenant.DoesNotExist:
            return api_error(code=API_CODE.NOT_FOUND, msg=f'未找到 enterprise_id={enterprise_id} 的租户')

    if not tenant:
        return api_error(code=API_CODE.BAD_REQUEST, msg='未提供 tenant_id 或 enterprise_id')

    # 执行匹配
    ent.matched_tenant = tenant
    ent.save(update_fields=['matched_tenant'])

    # 创建 DataConnector
    from .sync_service import _ensure_data_connector
    _ensure_data_connector(tenant, ent.platform_database, ent)

    # 更新平台统计
    platform_db = ent.platform_database
    platform_db.linked_tenant_count = platform_db.enterprises.filter(
        matched_tenant__isnull=False
    ).count()
    platform_db.save(update_fields=['linked_tenant_count'])

    return api_success({
        'enterprise_id': ent.enterprise_id,
        'enterprise_name': ent.enterprise_name,
        'tenant_id': tenant.id,
        'tenant_name': tenant.name,
    }, msg=f'已匹配：{ent.enterprise_name} → {tenant.name}')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def match_all_for_tenant(request: HttpRequest, tenant_id: int):
    """POST /api/v1/platform-databases/tenants/<tenant_id>/match-all/ — 为指定租户匹配所有平台

    租户创建后调用，自动匹配所有平台的 PlatformEnterprise。
    """
    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='租户不存在')

    result = match_tenant_to_platforms(tenant)
    return api_success(result, msg=f'匹配完成：{result["matched_count"]} 个平台，创建 {result["created_connectors"]} 个连接器')

"""
租户扩展 API —— 知识库/素材/任务/积分/SaaS/连接器
使用 Django 模型持久化
"""

from django.http import HttpRequest
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.platform.models import Tenant, TenantUser
from apps.platform.utils import api_success, api_error, API_CODE
from .models import (
    KnowledgeDoc, MediaAsset, Task, CreditLedger, Skill,
    SaaSConnection, DataConnector
)
from .serializers import (
    KnowledgeDocSerializer, MediaAssetSerializer, TaskSerializer,
    CreditLedgerSerializer, SkillSerializer, SaaSConnectionSerializer,
    DataConnectorSerializer, CreditRechargeSerializer
)


def _get_tenant(request: HttpRequest):
    tenant_id = getattr(request, 'tenant_id', None)
    if tenant_id:
        try:
            return Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            pass
    return Tenant.objects.first()


def _get_membership(request: HttpRequest):
    tenant = _get_tenant(request)
    if not tenant or not request.user.is_authenticated:
        return None, None
    try:
        return tenant, request.user.tenant_memberships.get(tenant=tenant)
    except TenantUser.DoesNotExist:
        return tenant, None


# ═══════════════════════════════════════
# 知识库
# ═══════════════════════════════════════


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def knowledge_docs(request: HttpRequest):
    """GET/POST /api/v1/docs — 知识文档（GET 返回直接数组）"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success([])

    if request.method == 'POST':
        serializer = KnowledgeDocSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(tenant=tenant, uploaded_by=request.user)
            return api_success(serializer.data, msg='文档已添加')
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))

    docs = tenant.knowledge_docs.all()
    data = KnowledgeDocSerializer(docs, many=True).data
    return api_success(data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def knowledge_doc_delete(request: HttpRequest, doc_id: str):
    """DELETE /api/v1/docs/<id> — 删除文档"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    try:
        doc = tenant.knowledge_docs.get(id=doc_id)
    except KnowledgeDoc.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='文档��存在')
    doc.delete()
    return api_success({'msg': '文档已删除'})


# ═══════════════════════════════════════
# 媒体素材
# ═══════════════════════════════════════


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def media_assets(request: HttpRequest):
    """GET/POST /api/v1/assets — 媒体素材"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success({'items': [], 'total': 0})

    if request.method == 'POST':
        serializer = MediaAssetSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(tenant=tenant, uploaded_by=request.user)
            return api_success(serializer.data, msg='素材已添加')
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))

    assets = tenant.media_assets.all()
    data = MediaAssetSerializer(assets, many=True).data
    return api_success({'items': data, 'total': len(data)})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def media_asset_delete(request: HttpRequest, asset_id: str):
    """DELETE /api/v1/assets/<id> — 删除素材"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    try:
        asset = tenant.media_assets.get(id=asset_id)
    except MediaAsset.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='素材不存在')
    asset.delete()
    return api_success({'msg': '素材已删除'})


# ═══════════════════════════════════════
# 定时任务
# ═══════════════════════════════════════


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def tasks(request: HttpRequest):
    """GET/POST /api/v1/tasks — 定时任务"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success({'items': [], 'total': 0})

    if request.method == 'POST':
        serializer = TaskSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(tenant=tenant)
            return api_success(serializer.data, msg='任务已创建')
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))

    task_list = tenant.tasks.all()
    data = TaskSerializer(task_list, many=True).data
    return api_success({'items': data, 'total': len(data)})


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def task_update(request: HttpRequest, task_id: str):
    """PUT /api/v1/tasks/<id> — 更新任务"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    try:
        task = tenant.tasks.get(id=task_id)
    except Task.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='任务不存在')

    serializer = TaskSerializer(task, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return api_success(serializer.data, msg='任务已更新')
    return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def task_delete(request: HttpRequest, task_id: str):
    """DELETE /api/v1/tasks/<id>/delete — 删除任务"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    try:
        task = tenant.tasks.get(id=task_id)
    except Task.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='任务不存在')
    task.delete()
    return api_success({'msg': '任务已删除'})


# ═══════════════════════════════════════
# 积分
# ═══════════════════════════════════════


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def credits_balance(request: HttpRequest):
    """GET /api/v1/credits/balance — 积分余额"""
    tenant, membership = _get_membership(request)
    if not membership:
        return api_success({'balance': 0})

    return api_success({'balance': membership.credits})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def credits_ledger(request: HttpRequest):
    """GET /api/v1/credits/ledger — 积分账本"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success({'items': [], 'total': 0})

    entries = tenant.credit_ledger.filter(user=request.user).order_by('-created_at')
    data = CreditLedgerSerializer(entries, many=True).data
    return api_success({'items': data, 'total': len(data)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def credits_recharge(request: HttpRequest):
    """POST /api/v1/credits/recharge — 积分充值"""
    tenant, membership = _get_membership(request)
    if not membership:
        return api_error(code=API_CODE.NOT_FOUND, msg='不是租户成员')

    serializer = CreditRechargeSerializer(data=request.data)
    if not serializer.is_valid():
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))

    amount = serializer.validated_data['amount']
    membership.credits += amount
    membership.save()

    # 记录账本
    entry = CreditLedger.objects.create(
        tenant=tenant, user=request.user,
        agent_code='system', agent_name='系统充值',
        amount=-amount, reason='积分充值',
        balance_after=membership.credits,
    )

    return api_success({
        'balance': membership.credits,
        'entry': CreditLedgerSerializer(entry).data,
    })


# ═══════════════════════════════════════
# 技能
# ═══════════════════════════════════════


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def skills_list(request: HttpRequest):
    """GET /api/v1/skills/list — 技能列表"""
    skills = Skill.objects.all()
    data = SkillSerializer(skills, many=True).data
    return api_success({'items': data, 'total': len(data)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def skills_toggle(request: HttpRequest):
    """POST /api/v1/skills/toggle — 切换技能安装状态"""
    name = request.data.get('name', '')
    if not name:
        return api_error(code=API_CODE.BAD_REQUEST, msg='缺少技能名称')

    try:
        skill = Skill.objects.get(name=name)
    except Skill.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='技能不存在')

    skill.installed = not skill.installed
    skill.save()
    return api_success(SkillSerializer(skill).data)


# ═══════════════════════════════════════
# SaaS 连接
# ═══════════════════════════════════════


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def saas_connections(request: HttpRequest):
    """GET /api/v1/saas/connections — SaaS连接列表"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success({'items': [], 'total': 0})

    connections = tenant.saas_connections.all()
    data = SaaSConnectionSerializer(connections, many=True).data
    return api_success({'items': data, 'total': len(data)})


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def saas_connection_update(request: HttpRequest, conn_id: str):
    """PUT /api/v1/saas/connections/<id> — 更新连接"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    try:
        conn = tenant.saas_connections.get(id=conn_id)
    except SaaSConnection.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='连接不存在')

    serializer = SaaSConnectionSerializer(conn, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return api_success(serializer.data, msg='连接已更新')
    return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))


# ═══════════════════════════════════════
# 数据连接器
# ═══════════════════════════════════════


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def connectors(request: HttpRequest):
    """GET/POST /api/v1/connectors — 数据连接器（GET 返回直接数组）"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success([])

    if request.method == 'POST':
        serializer = DataConnectorSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(tenant=tenant)
            return api_success(serializer.data, msg='连接器已添加')
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))

    connectors_qs = tenant.data_connectors.all()
    data = DataConnectorSerializer(connectors_qs, many=True).data
    return api_success(data)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def connector_update(request: HttpRequest, conn_id: str):
    """PUT /api/v1/connectors/<id> — 更新连接器"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    try:
        conn = tenant.data_connectors.get(id=conn_id)
    except DataConnector.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='连接器不存在')

    serializer = DataConnectorSerializer(conn, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return api_success(serializer.data, msg='连接器已更新')
    return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def connector_delete(request: HttpRequest, conn_id: str):
    """DELETE /api/v1/connectors/<id>/delete — 删除连接器"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    try:
        conn = tenant.data_connectors.get(id=conn_id)
    except DataConnector.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='连接器不存在')
    conn.delete()
    return api_success({'msg': '连接器已删除'})

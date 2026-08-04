"""
平台智能体 API + 工作流模板 API + 公共数据库预留 API
公开读取（无需鉴权），管理端增删改需权限
租户级 AgentConfig 写回需登录
"""
from django.http import HttpRequest
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated

from .utils import api_success, api_error, API_CODE
from .models import Agent, WorkflowTemplate, AgentConfig, Tenant
from .serializers import AgentSerializer, WorkflowTemplateSerializer, AgentConfigSerializer
from .permissions import has_platform_permission, require_platform_permission


# ═══════════════════════════════════════
# 公共数据库（预留 API — 后续补充多租户数据接入逻辑）
# ═══════════════════════════════════════

@api_view(['GET'])
@permission_classes([AllowAny])
def public_database_list(request: HttpRequest):
    """GET /api/v1/agents/public-databases/ — 公共数据库列表（预留）

    公共数据库是多租户通过 API 接过来的共享数据源。
    当前返回空列表，后续补充接入逻辑后返回真实数据。
    """
    return api_success({
        'databases': [],
        'msg': '公共数据库 API 已预留，等待接入逻辑'
    })


# ═══════════════════════════════════════
# 平台智能体（公开读取）
# ═══════════════════════════════════════

@api_view(['GET'])
@permission_classes([AllowAny])
def agent_list(request: HttpRequest):
    """GET /api/v1/agents/ — 公开列表

    ?all=1  需权限，返回全部（含未启用）
    """
    show_all = request.GET.get('all') == '1'
    qs = Agent.objects.all()
    if not show_all:
        qs = qs.filter(enabled=True)
    qs = qs.order_by('sort_order', 'id')
    return api_success(AgentSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.agents.manage')
def agent_create(request: HttpRequest):
    """POST /api/v1/agents/create — 新增平台智能体"""
    serializer = AgentSerializer(data=request.data)
    if not serializer.is_valid():
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))

    # 校验 OneToOne 约束：agent_role 不能已被其他智能体绑定
    from .models import AgentRole
    role_id = request.data.get('agent_role_id')
    if role_id:
        try:
            role = AgentRole.objects.get(id=role_id)
            if hasattr(role, 'bound_agent') and role.bound_agent:
                return api_error(
                    code=API_CODE.BAD_REQUEST,
                    msg=f'角色「{role.name}」已绑定智能体「{role.bound_agent.name}」，请先解绑或选择其他角色'
                )
        except AgentRole.DoesNotExist:
            return api_error(code=API_CODE.BAD_REQUEST, msg='指定的角色不存在')

    try:
        serializer.save()
    except Exception as e:
        return api_error(code=API_CODE.INTERNAL_ERROR, msg=f'保存失败: {e}')
    return api_success(serializer.data, msg='智能体已添加')


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def agent_detail(request: HttpRequest, pk: int):
    """GET 公开 / PUT DELETE 需权限 — 单条平台智能体"""
    try:
        agent = Agent.objects.get(id=pk)
    except Agent.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='智能体不存在')

    if request.method == 'GET':
        return api_success(AgentSerializer(agent).data)

    if not has_platform_permission(request.user, 'platform.agents.manage'):
        return api_error(code=API_CODE.FORBIDDEN, msg='无权限执行此操作')

    if request.method == 'PUT':
        serializer = AgentSerializer(agent, data=request.data, partial=True)
        if not serializer.is_valid():
            return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))
        serializer.save()
        return api_success(serializer.data, msg='智能体已更新')

    # 检查该智能体是否已分配给租户
    assigned_count = AgentConfig.objects.filter(agent_id=agent.agent_id).count()
    if assigned_count > 0:
        return api_error(
            code=API_CODE.BAD_REQUEST,
            msg=f'该智能体已分配给 {assigned_count} 个租户，请先解除分配后再删除'
        )

    agent.delete()
    return api_success({'msg': '智能体已删除'})


# ═══════════════════════════════════════
# 租户智能体配置（认证读写）
# ═══════════════════════════════════════

def _get_tenant(request: HttpRequest):
    """从请求头获取租户"""
    tenant_id = getattr(request, 'tenant_id', None)
    if tenant_id:
        try:
            return Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            pass
    return Tenant.objects.first()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def agent_config_list(request: HttpRequest):
    """GET /api/v1/agents/configs/ — 当前租户的全部智能体配置

    返回数组，每项含模型配置 + 租户覆盖字段（custom_name 等）
    """
    tenant = _get_tenant(request)
    if not tenant:
        return api_success([])
    configs = tenant.agent_configs.all()
    return api_success(AgentConfigSerializer(configs, many=True).data)


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def agent_config_detail(request: HttpRequest, agent_id: str):
    """GET/PUT /api/v1/agents/configs/<agent_id>/ — 单个智能体配置

    PUT 用于第三层写回：租户自定义名称/角色/描述/工作流/围巾颜色/绑定资源
    """
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    try:
        config = AgentConfig.objects.get(tenant=tenant, agent_id=agent_id)
    except AgentConfig.DoesNotExist:
        if request.method == 'PUT':
            # 自动创建（如果租户还没有这条配置）
            config = AgentConfig(tenant=tenant, agent_id=agent_id)
        else:
            return api_error(code=API_CODE.NOT_FOUND, msg='配置不存在')

    if request.method == 'GET':
        return api_success(AgentConfigSerializer(config).data)

    # PUT — 更新覆盖字段
    data = request.data
    if 'customName' in data or 'custom_name' in data:
        config.custom_name = data.get('customName', data.get('custom_name', ''))
    if 'customRole' in data or 'custom_role' in data:
        config.custom_role = data.get('customRole', data.get('custom_role', ''))
    if 'customDescription' in data or 'custom_description' in data:
        config.custom_description = data.get('customDescription', data.get('custom_description', ''))
    if 'customWorkflow' in data or 'custom_workflow' in data:
        config.custom_workflow = data.get('customWorkflow', data.get('custom_workflow', []))
    if 'customScarfColor' in data or 'custom_scarf_color' in data:
        config.custom_scarf_color = data.get('customScarfColor', data.get('custom_scarf_color', ''))
    if 'customAvatar' in data or 'custom_avatar' in data:
        config.custom_avatar = data.get('customAvatar', data.get('custom_avatar', ''))
    if 'boundDataBases' in data or 'bound_data_bases' in data:
        config.bound_data_bases = data.get('boundDataBases', data.get('bound_data_bases', []))
    if 'boundDocs' in data or 'bound_docs' in data:
        config.bound_docs = data.get('boundDocs', data.get('bound_docs', []))
    if 'boundImages' in data or 'bound_images' in data:
        config.bound_images = data.get('boundImages', data.get('bound_images', []))
    # 模型配置字段
    if 'modelId' in data or 'model_id' in data:
        config.model_id = data.get('modelId', data.get('model_id', ''))
    if 'temperature' in data:
        config.temperature = data.get('temperature', 0.7)
    if 'maxRetry' in data or 'max_retry' in data:
        config.max_retry = data.get('maxRetry', data.get('max_retry', 3))
    if 'fallbackModelId' in data or 'fallback_model_id' in data:
        config.fallback_model_id = data.get('fallbackModelId', data.get('fallback_model_id', ''))
    if 'humanTakeoverThreshold' in data or 'human_takeover_threshold' in data:
        config.human_takeover_threshold = data.get('humanTakeoverThreshold', data.get('human_takeover_threshold', 0.6))
    if 'custom' in data:
        config.custom = data.get('custom', {})
    if 'customWorkflowTemplateId' in data or 'custom_workflow_template_id' in data:
        val = data.get('customWorkflowTemplateId', data.get('custom_workflow_template_id'))
        config.custom_workflow_template_id = val if val else None

    config.save()
    return api_success(AgentConfigSerializer(config).data, msg='配置已保存')


# ═══════════════════════════════════════
# 工作流模板（公开读取）
# ═══════════════════════════════════════

@api_view(['GET'])
@permission_classes([AllowAny])
def workflow_template_list(request: HttpRequest):
    """GET /api/v1/workflow-templates/ — 公开列表

    ?all=1  需权限，返回全部（含未启用）
    ?category=xxx  按分类过滤
    """
    show_all = request.GET.get('all') == '1'
    category = request.GET.get('category')
    qs = WorkflowTemplate.objects.all()
    if not show_all:
        qs = qs.filter(enabled=True)
    if category:
        qs = qs.filter(category=category)
    qs = qs.order_by('sort_order', 'id')
    return api_success(WorkflowTemplateSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.workflows.manage')
def workflow_template_create(request: HttpRequest):
    """POST /api/v1/workflow-templates/create — 新增工作流模板"""
    serializer = WorkflowTemplateSerializer(data=request.data)
    if not serializer.is_valid():
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))
    serializer.save()
    return api_success(serializer.data, msg='模板已添加')


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def workflow_template_detail(request: HttpRequest, pk: int):
    """GET 公开 / PUT DELETE 需权限 — 单条工作流模板"""
    try:
        template = WorkflowTemplate.objects.get(id=pk)
    except WorkflowTemplate.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='模板不存在')

    if request.method == 'GET':
        return api_success(WorkflowTemplateSerializer(template).data)

    if not has_platform_permission(request.user, 'platform.workflows.manage'):
        return api_error(code=API_CODE.FORBIDDEN, msg='无权限执行此操作')

    if request.method == 'PUT':
        serializer = WorkflowTemplateSerializer(template, data=request.data, partial=True)
        if not serializer.is_valid():
            return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))
        serializer.save()
        return api_success(serializer.data, msg='模板已更新')

    template.delete()
    return api_success({'msg': '模板已删除'})

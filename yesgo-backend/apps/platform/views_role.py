"""
智能体角色 API

智能体角色（AgentRole）定义智能体的角色定位与专业能力，
一个角色可绑定一个智能体，一个智能体在同一时刻只能绑定一个角色。
AI 执行工作流时会读取该角色的 description 注入 prompt。
"""
from django.http import HttpRequest
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated

from .utils import api_success, api_error, API_CODE
from .models import AgentRole, Agent
from .serializers import AgentRoleSerializer, AgentSerializer
from .permissions import has_platform_permission, require_platform_permission


@api_view(['GET'])
@permission_classes([AllowAny])
def agent_role_list(request: HttpRequest):
    """GET /api/v1/agents/roles/ — 公开列表

    ?all=1  需权限，返回全部（含未启用）
    """
    show_all = request.GET.get('all') == '1'
    qs = AgentRole.objects.all().select_related('bound_agent')
    if not show_all:
        qs = qs.filter(enabled=True)
    qs = qs.order_by('sort', 'id')
    return api_success(AgentRoleSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.agents.manage')
def agent_role_create(request: HttpRequest):
    """POST /api/v1/agents/roles/create/ — 新增智能体角色"""
    data = request.data.copy()
    # 绑定智能体时通过 agent_id 传入
    agent_id = data.pop('agent_id', None)
    serializer = AgentRoleSerializer(data=data)
    if not serializer.is_valid():
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))

    role = serializer.save()
    if agent_id:
        _bind_agent(role, agent_id)

    return api_success(AgentRoleSerializer(role).data, msg='智能体角色已添加')


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def agent_role_detail(request: HttpRequest, pk: int):
    """GET 公开 / PUT DELETE 需权限 — 单条智能体角色"""
    try:
        role = AgentRole.objects.select_related('bound_agent').get(id=pk)
    except AgentRole.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='智能体角色不存在')

    if request.method == 'GET':
        return api_success(AgentRoleSerializer(role).data)

    if not has_platform_permission(request.user, 'platform.agents.manage'):
        return api_error(code=API_CODE.FORBIDDEN, msg='无权限执行此操作')

    if request.method == 'PUT':
        data = request.data.copy()
        agent_id = data.pop('agent_id', None)
        serializer = AgentRoleSerializer(role, data=data, partial=True)
        if not serializer.is_valid():
            return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))
        role = serializer.save()
        if agent_id is not None:
            _bind_agent(role, agent_id)
        return api_success(AgentRoleSerializer(role).data, msg='智能体角色已更新')

    # DELETE：先解绑智能体，再删除角色
    try:
        bound = role.bound_agent
    except Agent.DoesNotExist:
        bound = None
    if bound:
        bound.agent_role = None
        bound.save(update_fields=['agent_role'])
    role.delete()
    return api_success({'msg': '智能体角色已删除'})


def _bind_agent(role: AgentRole, agent_id):
    """将角色绑定到指定智能体，同时确保一个智能体只绑定一个角色。

    agent_id 为 None/空字符串时，表示解绑当前角色。
    """
    # 先解绑当前角色已绑定的智能体（related_name 不存在时会抛异常）
    try:
        old_agent = role.bound_agent
    except Agent.DoesNotExist:
        old_agent = None
    if old_agent:
        old_agent.agent_role = None
        old_agent.save(update_fields=['agent_role'])

    if not agent_id:
        return

    try:
        if isinstance(agent_id, int):
            agent = Agent.objects.get(id=agent_id)
        else:
            agent = Agent.objects.get(id=int(agent_id))
    except (Agent.DoesNotExist, ValueError, TypeError):
        return

    # 如果被绑定的智能体已有其他角色，先解绑
    if agent.agent_role and agent.agent_role.id != role.id:
        agent.agent_role = None
        agent.save(update_fields=['agent_role'])

    agent.agent_role = role
    agent.save(update_fields=['agent_role'])

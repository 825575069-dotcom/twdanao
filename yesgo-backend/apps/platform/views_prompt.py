"""
提示词 API —— 首页提示词 / 普通提示词
公开读取（无需鉴权），管理端增删改需 prompts.manage 权限
"""
from django.http import HttpRequest
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated

from .utils import api_success, api_error, API_CODE
from .models import Prompt, Tenant
from .serializers import PromptSerializer
from .permissions import has_platform_permission


def _no_cache(response):
    """为响应添加 no-cache 头，防止浏览器/CDN 缓存提示词数据"""
    response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response['Pragma'] = 'no-cache'
    response['Expires'] = '0'
    return response


@api_view(['GET'])
@permission_classes([AllowAny])
def prompt_list(request: HttpRequest):
    """GET /api/v1/prompts/ — 公开列表

    ?type=home|chat  按类型过滤
    ?all=1           需 prompts.manage 权限，返回全部（含未启用）
    """
    ptype = request.GET.get('type')
    category = request.GET.get('category')
    show_all = request.GET.get('all') == '1'
    if show_all and not (request.user.is_authenticated and has_platform_permission(request.user, 'platform.prompts.manage')):
        show_all = False

    qs = Prompt.objects.all()
    if ptype:
        if ptype not in ('home', 'chat', 'purchase_chat', 'purchase_home'):
            return api_error(code=API_CODE.BAD_REQUEST, msg='type 参数非法（应为 home/chat/purchase_chat/purchase_home）')
        qs = qs.filter(prompt_type=ptype)

    if category:
        qs = qs.filter(category=category)

    if not show_all:
        qs = qs.filter(enabled=True)

    if ptype == 'home':
        qs = qs.order_by('category', 'sort', 'id')
    else:
        qs = qs.order_by('category', 'sort', 'id')

    return _no_cache(api_success(PromptSerializer(qs, many=True).data))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def prompt_create(request: HttpRequest):
    """POST /api/v1/prompts/create — 新增提示词（需要平台 prompts.manage 权限）"""
    if not has_platform_permission(request.user, 'platform.prompts.manage'):
        return api_error(code=API_CODE.FORBIDDEN, msg='无权限执行此操作')
    serializer = PromptSerializer(data=request.data)
    if not serializer.is_valid():
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))
    serializer.save()
    return api_success(serializer.data, msg='提示词已添加')


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def prompt_detail(request: HttpRequest, pk: int):
    """GET / PUT / DELETE 单条提示词

    GET 公开；PUT/DELETE 需 prompts.manage 权限
    """
    try:
        prompt = Prompt.objects.get(id=pk)
    except Prompt.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='提示词不存在')

    if request.method == 'GET':
        return _no_cache(api_success(PromptSerializer(prompt).data))

    # 修改 / 删除需要平台权限（提示词管理属于第二层）
    if not has_platform_permission(request.user, 'platform.prompts.manage'):
        return api_error(code=API_CODE.FORBIDDEN, msg='无权限执行此操作')

    if request.method == 'PUT':
        serializer = PromptSerializer(prompt, data=request.data, partial=True)
        if not serializer.is_valid():
            return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))
        serializer.save()
        return api_success(serializer.data, msg='提示词已更新')

    # DELETE
    prompt.delete()
    return api_success({'msg': '提示词已删除'})

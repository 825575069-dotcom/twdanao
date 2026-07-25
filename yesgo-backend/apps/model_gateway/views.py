"""
模型网关 API — 模型列表/测试/配置/部署
使用 Django 模型持久化
"""

from django.http import HttpRequest
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.platform.utils import api_success, api_error, API_CODE
from apps.platform.permissions import require_permission
from .models import AIModel
from .serializers import AIModelSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_permission('models.view')
def models_list(request: HttpRequest):
    """GET /api/v1/models/list — 模型列表（返回直接数组）"""
    models = AIModel.objects.all()
    data = AIModelSerializer(models, many=True).data
    return api_success(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_permission('models.view')
def models_test(request: HttpRequest):
    """POST /api/v1/models/test — 测试模型连接"""
    model_id = request.data.get('modelId') or request.data.get('model_id')
    if not model_id:
        return api_error(code=API_CODE.BAD_REQUEST, msg='缺少 modelId')

    try:
        model = AIModel.objects.get(id=model_id)
    except AIModel.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='模型不存在')

    # Mock 测试：始终返回成功
    import random
    return api_success({
        'modelId': str(model.id),
        'status': 'connected',
        'latencyMs': random.randint(80, 300),
        'msg': f'{model.name} 连接测试成功',
    })


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
@require_permission('models.view')
def models_config(request: HttpRequest):
    """PUT /api/v1/models/config — 更新模型配置"""
    model_id = request.data.get('modelId') or request.data.get('model_id')
    if not model_id:
        return api_error(code=API_CODE.BAD_REQUEST, msg='缺少 modelId')

    try:
        model = AIModel.objects.get(id=model_id)
    except AIModel.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='模型不存在')

    allowed_fields = ['temperature', 'max_tokens', 'endpoint', 'api_key', 'config']
    for key in allowed_fields:
        if key in request.data:
            if key == 'config':
                model.config = {**model.config, **request.data[key]}
            else:
                setattr(model, key, request.data[key])
    model.save()
    return api_success({'msg': '模型配置已更新'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_permission('models.view')
def models_deploy(request: HttpRequest):
    """POST /api/v1/models/deploy — 部署/激活模型"""
    model_id = request.data.get('modelId') or request.data.get('model_id')
    if not model_id:
        return api_error(code=API_CODE.BAD_REQUEST, msg='缺少 modelId')

    try:
        model = AIModel.objects.get(id=model_id)
    except AIModel.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='模型不存在')

    model.status = 'ready'
    model.save()
    return api_success({'modelId': str(model.id), 'status': 'ready', 'msg': f'{model.name} 已激活'})

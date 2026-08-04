"""
统一 API 响应工具
对齐架构文档：所有 API 返回 { code, msg, data }
code=0 成功，非 0 为业务错误码
"""
import json
from django.http import JsonResponse


# 业务码定义（对齐前端 src/lib/constants.ts）
class API_CODE:
    SUCCESS = 0
    BAD_REQUEST = 400
    UNAUTHORIZED = 401
    FORBIDDEN = 403
    NOT_FOUND = 404
    INTERNAL_ERROR = 500


def api_success(data=None, msg='ok'):
    """成功响应"""
    return JsonResponse({'code': API_CODE.SUCCESS, 'msg': msg, 'data': data})


def api_error(code=API_CODE.BAD_REQUEST, msg='错误', data=None):
    """错误响应"""
    return JsonResponse({'code': code, 'msg': msg, 'data': data})


def custom_exception_handler(exc, context):
    """DRF 异常处理器 → 统一 {code, msg, data} 格式"""
    from rest_framework.views import exception_handler
    from rest_framework.exceptions import ValidationError

    response = exception_handler(exc, context)

    if isinstance(exc, ValidationError):
        # 验证错误 → 400
        return JsonResponse({
            'code': API_CODE.BAD_REQUEST,
            'msg': str(exc.detail) if hasattr(exc, 'detail') else str(exc),
            'data': None
        }, status=200)

    if response is not None:
        return JsonResponse({
            'code': response.status_code,
            'msg': str(exc),
            'data': None
        }, status=200)
    return JsonResponse({
        'code': API_CODE.INTERNAL_ERROR,
        'msg': f'服务器内部错误: {str(exc)}',
        'data': None
    }, status=200)

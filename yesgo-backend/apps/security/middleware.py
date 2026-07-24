"""
审计日志中间件 —— 自动记录所有 API 请求
安装在 TenantMiddleware 之后，自动写入 AuditLog
"""

import time
import json
from django.utils import timezone

from apps.platform.models import Tenant


class AuditMiddleware:
    """操作审计中间件 —— 记录所有 API 请求到 AuditLog"""

    # 不记录审计日志的路径前缀（静态资源、健康检查等）
    SKIP_PATHS = [
        '/api/v1/health',
        '/admin/',
        '/static/',
        '/favicon.ico',
    ]

    # 高风险操作路径（提升风险等级）
    HIGH_RISK_PATHS = [
        ('/auth/login', 'login', 'medium'),
        ('/auth/logout', 'logout', 'low'),
        ('/members/', 'permission_change', 'high'),
        ('/roles/', 'permission_change', 'high'),
        ('/credits/recharge', 'config_change', 'high'),
        ('/config/', 'config_change', 'medium'),
        ('/connectors/', 'config_change', 'medium'),
    ]

    # 写操作 HTTP 方法 → 操作类型映射
    METHOD_ACTION_MAP = {
        'POST': 'create',
        'PUT': 'update',
        'PATCH': 'update',
        'DELETE': 'delete',
    }

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 跳过不需要审计的路径
        if any(request.path.startswith(p) for p in self.SKIP_PATHS):
            return self.get_response(request)

        start_time = time.time()
        response = self.get_response(request)
        duration_ms = int((time.time() - start_time) * 1000)

        # 异步写入审计日志（当前同步写入，后续可改为 Celery 异步任务）
        try:
            self._write_audit_log(request, response, duration_ms)
        except Exception:
            pass  # 审计日志写入失败不影响正常请求

        return response

    def _write_audit_log(self, request, response):
        """写入审计日志"""
        from .models import AuditLog, SecurityConfig

        # 获取租户
        tenant_id = getattr(request, 'tenant_id', None)
        tenant = None
        if tenant_id:
            try:
                tenant = Tenant.objects.get(id=tenant_id)
            except Tenant.DoesNotExist:
                pass
        if not tenant:
            tenant = Tenant.objects.first()
        if not tenant:
            return

        # 检查审计是否启用
        try:
            config = SecurityConfig.objects.get(tenant=tenant)
            if not config.audit_enabled:
                return
        except SecurityConfig.DoesNotExist:
            config = None

        # 确定操作类型和风险等级
        action = 'api_call'
        risk_level = 'low'
        for path_prefix, act, risk in self.HIGH_RISK_PATHS:
            if path_prefix in request.path:
                action = act
                risk_level = risk
                break
        else:
            action = self.METHOD_ACTION_MAP.get(request.method, 'query')

        # GET 请求只记录查询（低风险）
        if request.method == 'GET':
            action = 'query'
            risk_level = 'low'

        # 响应状态码非2xx提升风险等级
        status_code = response.status_code if hasattr(response, 'status_code') else 200
        if status_code >= 500:
            risk_level = 'high'
        elif status_code >= 400:
            if risk_level == 'low':
                risk_level = 'medium'

        # 脱敏请求体
        from .utils import mask_request_body
        request_body = {}
        try:
            if request.body:
                body = json.loads(request.body)
                request_body = mask_request_body(body, config)
        except Exception:
            pass

        # 提取资源类型
        resource_type = ''
        resource_id = ''
        path_parts = request.path.strip('/').split('/')
        if len(path_parts) >= 4:
            resource_type = path_parts[3] if len(path_parts) > 3 else ''
            # 最后一部分如果是数字则为资源ID
            last_part = path_parts[-1] if path_parts else ''
            if last_part.isdigit():
                resource_id = last_part

        # 获取用户
        user = getattr(request, 'user', None)
        if user and not user.is_authenticated:
            user = None

        # 获取IP地址
        ip = self._get_client_ip(request)

        # 写入审计日志
        AuditLog.objects.create(
            tenant=tenant,
            user=user,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            description=f'{request.method} {request.path}',
            method=request.method,
            path=request.path,
            ip_address=ip,
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
            request_body=request_body,
            response_status=status_code,
            duration_ms=duration_ms,
            risk_level=risk_level,
        )

    def _get_client_ip(self, request):
        """获取客户端真实IP"""
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded:
            return x_forwarded.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '')

"""
租户中间件 — 从请求头 X-Tenant-ID 或 JWT Token 推断租户 ID
"""


class TenantMiddleware:
    """从 X-Tenant-ID 请求头提取租户 ID，附加到 request 对象。

    优先级：
    1. X-Tenant-ID 请求头（管理后台跨租户操作时使用）
    2. JWT Token 中的用户租户成员关系（租户应用登录后自动推断）
    3. None（未认证或无租户成员关系时）
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        tenant_id = request.headers.get('X-Tenant-ID', '')
        if tenant_id:
            try:
                request.tenant_id = int(tenant_id)
            except (ValueError, TypeError):
                request.tenant_id = None
        else:
            request.tenant_id = None

        # 如果 X-Tenant-ID 未提供，尝试从 JWT Token 推断用户租户
        if not request.tenant_id:
            request.tenant_id = self._infer_tenant_from_jwt(request)

        response = self.get_response(request)
        return response

    def _infer_tenant_from_jwt(self, request):
        """从 JWT Authorization 头解析用户 ID，查找其租户成员关系"""
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return None

        token = auth_header[7:]
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            from apps.platform.models import TenantUser
            decoded = AccessToken(token)
            user_id = decoded.get('user_id')
            if not user_id:
                return None
            membership = TenantUser.objects.filter(user_id=user_id).select_related('tenant').first()
            if membership:
                return membership.tenant_id
        except Exception:
            pass
        return None

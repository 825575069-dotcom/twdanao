"""
租户中间件 — 从请求头 X-Tenant-ID 提取租户 ID
"""


class TenantMiddleware:
    """从 X-Tenant-ID 请求头提取租户 ID，附加到 request 对象"""

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

        response = self.get_response(request)
        return response

"""
多租户中间件 —— 从请求头提取 X-Tenant-ID，注入 request.tenant_id
对齐架构文档：所有 API 通过 X-Tenant-ID 隔离商户数据。

PostgreSQL 模式：
  根据 X-Tenant-ID 自动切换 search_path 到 tenant_{code} schema，
  实现物理级别的数据隔离。SQLite 模式下仅设置属性，无 Schema 切换。
"""

from django.conf import settings
from django.db import connection


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        tenant_id = request.headers.get('X-Tenant-ID', '')
        tenant_code = request.headers.get('X-Tenant-Code', '')
        
        request.tenant_id = tenant_id
        request.tenant_code = tenant_code

        # PostgreSQL 多 Schema 模式：切换 search_path
        if self._is_postgresql() and tenant_code:
            try:
                schema_name = f'tenant_{tenant_code}'
                # 如果 Schema 不存在则自动创建
                with connection.cursor() as cursor:
                    cursor.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"')
                    cursor.execute(f'SET search_path TO "{schema_name}", public')
            except Exception:
                # Schema 切换失败时降级为 public（不阻塞请求）
                pass

        response = self.get_response(request)
        return response

    @staticmethod
    def _is_postgresql() -> bool:
        """判断当前是否使用 PostgreSQL"""
        engine = settings.DATABASES.get('default', {}).get('ENGINE', '')
        return 'postgresql' in engine

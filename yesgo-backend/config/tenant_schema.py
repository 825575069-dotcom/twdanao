"""
租户 Schema 管理工具
负责创建/删除租户 PostgreSQL Schema，运行租户级 migration。
"""

from django.db import connection
from django.conf import settings


def get_tenant_schema(tenant_code: str) -> str:
    """获取租户对应的 schema 名称"""
    return f'tenant_{tenant_code}'


def create_tenant_schema(tenant_code: str) -> str:
    """
    为新租户创建独立 Schema。
    返回 schema 名称。
    """
    schema_name = get_tenant_schema(tenant_code)
    with connection.cursor() as cursor:
        cursor.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"')
    return schema_name


def drop_tenant_schema(tenant_code: str):
    """删除租户 Schema（危险操作，需确认）。"""
    schema_name = get_tenant_schema(tenant_code)
    with connection.cursor() as cursor:
        cursor.execute(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE')


def set_tenant_search_path(tenant_code: str):
    """
    设置当前连接的 search_path 到指定租户 Schema。
    应在 middleware 或请求处理的早期调用。
    
    自动包含 public schema 以支持跨 Schema 查询共享表。
    """
    schema_name = get_tenant_schema(tenant_code)
    with connection.cursor() as cursor:
        cursor.execute(f'SET search_path TO "{schema_name}", public')


def reset_search_path():
    """重置 search_path 为 public。"""
    with connection.cursor() as cursor:
        cursor.execute('SET search_path TO public')


def get_all_tenant_schemas():
    """获取所有租户 Schema 列表。"""
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT schema_name FROM information_schema.schemata
            WHERE schema_name LIKE 'tenant_%'
            ORDER BY schema_name
        """)
        return [row[0] for row in cursor.fetchall()]


def schema_exists(schema_name: str) -> bool:
    """检查 Schema 是否存在。"""
    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = %s)',
            [schema_name]
        )
        return cursor.fetchone()[0]


def migrate_tenant_schema(tenant_code: str):
    """
    对指定租户 Schema 运行 migration。
    实际通过 `python manage.py migrate --schema tenant_{code}` 调用。
    此函数只做前置校验。
    """
    schema_name = get_tenant_schema(tenant_code)
    if not schema_exists(schema_name):
        create_tenant_schema(tenant_code)
    return schema_name

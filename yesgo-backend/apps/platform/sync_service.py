"""平台数据库同步服务

标准同步协议：
  请求：GET {api_base_url}/api/brain/enterprises/
        Header: Authorization: Bearer {api_token}
  响应：{
    "code": 0,
    "data": {
      "total": N,
      "enterprises": [
        {
          "enterprise_id": "统一社会信用代码",
          "enterprise_name": "企业名称",
          "db_type": "mysql" | "api",
          "db_config": {
            "mysql": {"host": "...", "port": 3306, "database": "...", "username": "...", "password": "..."},
            "api":   {"api_url": "...", "api_token": "..."}
          }
        }
      ]
    }
  }
"""
import logging
from datetime import datetime
from django.utils import timezone
from django.db import transaction

from .models import PlatformDatabase, PlatformEnterprise, Tenant
from apps.tenant_ext.models import DataConnector

logger = logging.getLogger(__name__)

# 同步协议路径
SYNC_PATH = '/api/brain/enterprises/'
SYNC_TIMEOUT = 15  # 秒


def sync_platform_enterprises(platform_db: PlatformDatabase) -> dict:
    """从 SaaS 平台同步企业列表

    Returns:
        {
            'success': bool,
            'total': int,         # 平台返回的企业总数
            'synced': int,        # 本次写入/更新的企业数
            'matched': int,       # 匹配到租户的企业数
            'unmatched': int,     # 未匹配到租户的企业数
            'error': str,         # 错误信息（success=False 时）
        }
    """
    import requests

    if not platform_db.api_base_url:
        return _sync_fail(platform_db, '未配置同步 API 地址')

    url = platform_db.api_base_url.rstrip('/') + SYNC_PATH
    headers = {}
    if platform_db.api_token:
        headers['Authorization'] = f'Bearer {platform_db.api_token}'

    try:
        resp = requests.get(url, headers=headers, timeout=SYNC_TIMEOUT)
    except requests.exceptions.Timeout:
        return _sync_fail(platform_db, f'请求超时（{SYNC_TIMEOUT}s）: {url}')
    except requests.exceptions.ConnectionError as e:
        return _sync_fail(platform_db, f'连接失败: {url} — {e}')
    except Exception as e:
        return _sync_fail(platform_db, f'请求异常: {e}')

    if resp.status_code != 200:
        return _sync_fail(platform_db, f'HTTP {resp.status_code}: {url}')

    try:
        body = resp.json()
    except Exception:
        return _sync_fail(platform_db, '响应不是有效 JSON')

    if body.get('code') != 0:
        msg = body.get('msg', '未知错误')
        return _sync_fail(platform_db, f'平台返回错误: {msg}')

    data = body.get('data', {})
    enterprises = data.get('enterprises', [])
    total = data.get('total', len(enterprises))

    synced_count = 0
    matched_count = 0

    with transaction.atomic():
        for ent in enterprises:
            eid = ent.get('enterprise_id', '').strip()
            if not eid:
                continue

            # upsert PlatformEnterprise
            obj, created = PlatformEnterprise.objects.update_or_create(
                platform_database=platform_db,
                enterprise_id=eid,
                defaults={
                    'enterprise_name': ent.get('enterprise_name', ''),
                    'db_type': ent.get('db_type', 'mysql'),
                    'db_config': ent.get('db_config', {}),
                }
            )

            # 匹配租户（按统一社会信用代码）
            matched_tenant = None
            try:
                matched_tenant = Tenant.objects.get(enterprise_id=eid)
            except Tenant.DoesNotExist:
                pass
            except Tenant.MultipleObjectsReturned:
                # 取第一个 active 的
                matched_tenant = Tenant.objects.filter(enterprise_id=eid).first()

            obj.matched_tenant = matched_tenant
            obj.save()

            synced_count += 1
            if matched_tenant:
                matched_count += 1
                # 自动为匹配的租户创建/更新 DataConnector
                _ensure_data_connector(matched_tenant, platform_db, obj)

    # 更新平台统计
    platform_db.last_synced_at = timezone.now()
    platform_db.last_sync_status = 'success'
    platform_db.last_sync_error = ''
    platform_db.total_enterprises = total
    platform_db.linked_tenant_count = matched_count
    platform_db.save(update_fields=[
        'last_synced_at', 'last_sync_status', 'last_sync_error',
        'total_enterprises', 'linked_tenant_count'
    ])

    return {
        'success': True,
        'total': total,
        'synced': synced_count,
        'matched': matched_count,
        'unmatched': synced_count - matched_count,
        'error': '',
    }


def _sync_fail(platform_db: PlatformDatabase, error_msg: str) -> dict:
    """记录同步失败"""
    platform_db.last_synced_at = timezone.now()
    platform_db.last_sync_status = 'failed'
    platform_db.last_sync_error = error_msg[:500]
    platform_db.save(update_fields=[
        'last_synced_at', 'last_sync_status', 'last_sync_error'
    ])
    return {
        'success': False,
        'total': 0,
        'synced': 0,
        'matched': 0,
        'unmatched': 0,
        'error': error_msg,
    }


def _ensure_data_connector(tenant: Tenant, platform_db: PlatformDatabase, ent: PlatformEnterprise):
    """为匹配的租户自动创建/更新 DataConnector

    如果租户已有该 PlatformEnterprise 对应的 DataConnector，则更新连接信息；
    否则创建新的 DataConnector。
    """
    connector = DataConnector.objects.filter(
        tenant=tenant,
        platform_enterprise=ent,
    ).first()

    if connector:
        # 更新已有的连接器
        connector.name = f'{platform_db.name} - {ent.enterprise_name or ent.enterprise_id}'
        connector.type = platform_db.type
        connector.enterprise_id = ent.enterprise_id
        connector.db_type = ent.db_type
        connector.db_config = ent.db_config
        connector.status = 'connected'
        connector.enabled = True
        connector.last_sync = timezone.now()
        connector.save()
    else:
        # 创建新连接器
        DataConnector.objects.create(
            tenant=tenant,
            name=f'{platform_db.name} - {ent.enterprise_name or ent.enterprise_id}',
            type=platform_db.type,
            description=f'由平台同步自动创建（{platform_db.name}）',
            icon_name=platform_db.icon_name,
            enabled=True,
            status='connected',
            config={},
            platform_enterprise=ent,
            enterprise_id=ent.enterprise_id,
            db_type=ent.db_type,
            db_config=ent.db_config,
            last_sync=timezone.now(),
        )


def match_tenant_to_platforms(tenant: Tenant) -> dict:
    """租户创建/更新后，主动匹配所有平台的 PlatformEnterprise

    Returns:
        {
            'matched_platforms': [平台名称],
            'matched_count': int,
            'created_connectors': int,
        }
    """
    if not tenant.enterprise_id:
        return {'matched_platforms': [], 'matched_count': 0, 'created_connectors': 0}

    matched_platforms = []
    created_connectors = 0

    for ent in PlatformEnterprise.objects.filter(enterprise_id=tenant.enterprise_id):
        ent.matched_tenant = tenant
        ent.save(update_fields=['matched_tenant'])

        platform_db = ent.platform_database
        matched_platforms.append(platform_db.name)

        # 创建 DataConnector
        existing = DataConnector.objects.filter(
            tenant=tenant,
            platform_enterprise=ent,
        ).exists()
        if not existing:
            _ensure_data_connector(tenant, platform_db, ent)
            created_connectors += 1

        # 更新平台统计
        platform_db.linked_tenant_count = platform_db.enterprises.filter(
            matched_tenant__isnull=False
        ).count()
        platform_db.save(update_fields=['linked_tenant_count'])

    return {
        'matched_platforms': matched_platforms,
        'matched_count': len(matched_platforms),
        'created_connectors': created_connectors,
    }

"""
多 Schema 数据库路由器（PostgreSQL）
架构对齐《YesGo 平台架构设计 v1.1》第 5.2 章 —— 多租户 Schema 隔离

Schema 分层：
  - public    ：共享库（platform 模块：租户/用户/角色/套餐）
  - tenant_*  ：租户私库（tenant_db/chat/model_gateway/dashboard/memory_engine/security）
  - platform  ：平台管理库（platform_gateway，预留）
"""

SHARED_APPS = {
    'platform',
    'contenttypes',
    'auth',
    'sessions',
    'admin',
}

TENANT_APPS = {
    'tenant_db',
    'chat',
    'model_gateway',
    'dashboard',
    'memory_engine',
    'security',
    'tenant_ext',
    'platform_gateway',
}


class MultiSchemaRouter:
    """
    按 app_label 路由到对应 PostgreSQL Schema。

    用法：
        settings.py 中设置 DATABASE_ROUTERS = ['config.db_router.MultiSchemaRouter']
        middleware 中设置 request.tenant_code → 连接时 SET search_path = tenant_{code}
    """

    def _is_shared(self, model):
        return model._meta.app_label in SHARED_APPS

    def _is_tenant(self, model):
        return model._meta.app_label in TENANT_APPS

    def db_for_read(self, model, **hints):
        return 'default'

    def db_for_write(self, model, **hints):
        return 'default'

    def allow_relation(self, obj1, obj2, **hints):
        # 共享模型之间可以关联，租户模型之间也可以关联
        # 不允许跨库关联（共享 ↔ 租户 用 tenant_id 逻辑外键代替）
        if self._is_shared(obj1) and self._is_shared(obj2):
            return True
        if self._is_tenant(obj1) and self._is_tenant(obj2):
            return True
        # 跨类型不允许物理外键
        return False

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """
        控制 migrate 命令的行为：
        - 共享 app → 只迁移到 public schema
        - 租户 app → 迁移到 tenant_* schema（通过 management command）
        """
        if db != 'default':
            return False
        return True

from django.apps import AppConfig

class TenantDbConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.tenant_db'
    verbose_name = '数据底座'

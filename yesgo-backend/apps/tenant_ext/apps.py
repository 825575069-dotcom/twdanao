from django.apps import AppConfig

class TenantExtConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.tenant_ext'
    verbose_name = '租户扩展'

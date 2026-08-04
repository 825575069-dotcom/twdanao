from django.apps import AppConfig


class PublicDatabaseConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.public_database'
    verbose_name = '公共数据库'

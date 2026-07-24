from django.apps import AppConfig


class MemoryEngineConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.memory_engine'
    verbose_name = '记忆引擎'

"""
Django settings for YesGo 天网大脑后端 (第二层)
对齐《YesGo 平台架构设计 v1.1》

数据库模式：
  - 开发：SQLite（零配置，即开即用）
  - 生产：PostgreSQL 多 Schema（DB_ENGINE=postgresql 时自动切换）
"""

import os
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

# ============================================================
# 环境检测
# ============================================================
DB_ENGINE = os.environ.get('DB_ENGINE', 'sqlite')  # sqlite | postgresql
DEBUG = os.environ.get('DEBUG', 'True').lower() in ('true', '1', 'yes')
SECRET_KEY = os.environ.get('SECRET_KEY', 'yesgo-tianwang-brain-secret-key-2026')
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '*').split(',')

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    # 本项目 apps
    'apps.platform',
    'apps.tenant_db',
    'apps.chat',
    'apps.model_gateway',
    'apps.dashboard',
    'apps.platform_gateway',
    'apps.tenant_ext',
    'apps.memory_engine',
    'apps.security',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'middleware.tenant.TenantMiddleware',
    'apps.security.middleware.AuditMiddleware',
]

ROOT_URLCONF = 'config.urls'

# ============================================================
# 数据库配置（SQLite 开发 / PostgreSQL 生产）
# ============================================================
if DB_ENGINE == 'postgresql':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('POSTGRES_DB', 'yesgo'),
            'USER': os.environ.get('POSTGRES_USER', 'yesgo'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'yesgo123'),
            'HOST': os.environ.get('POSTGRES_HOST', 'postgres'),
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
            'OPTIONS': {
                'options': '-c search_path=public',
            },
            'CONN_MAX_AGE': 600,
            'CONN_HEALTH_CHECKS': True,
        },
    }
    # 多 Schema 路由器
    DATABASE_ROUTERS = ['config.db_router.MultiSchemaRouter']
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# ============================================================
# Celery + Redis 异步任务
# ============================================================
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/1')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Asia/Shanghai'
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 单任务最大 30 分钟
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60

# 任务队列路由
CELERY_TASK_ROUTES = {
    'apps.memory_engine.tasks.*': {'queue': 'memory'},
    'apps.model_gateway.tasks.*': {'queue': 'model'},
    'apps.chat.tasks.*': {'queue': 'chat'},
    '*': {'queue': 'default'},
}

# Celery Beat 定时任务
from celery.schedules import crontab
CELERY_BEAT_SCHEDULE = {
    'cleanup-expired-memories': {
        'task': 'apps.memory_engine.tasks.cleanup_expired_memories',
        'schedule': crontab(hour=3, minute=0),  # 每天凌晨 3 点
    },
    'reset-daily-quotas': {
        'task': 'apps.model_gateway.tasks.reset_daily_quotas',
        'schedule': crontab(hour=0, minute=5),  # 每天 0:05
    },
    'health-check-keys': {
        'task': 'apps.model_gateway.tasks.health_check_keys',
        'schedule': crontab(minute='*/30'),  # 每 30 分钟
    },
}

# ============================================================
# Redis 缓存
# ============================================================
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': os.environ.get('REDIS_CACHE_URL', 'redis://localhost:6379/2'),
    }
}

# ============================================================
# DRF 配置
# ============================================================
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.AllowAny',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    'EXCEPTION_HANDLER': 'apps.platform.utils.custom_exception_handler',
}

# ============================================================
# JWT 配置
# ============================================================
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=24),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ISSUER': 'yesgo',
}

# ============================================================
# CORS
# ============================================================
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOW_CREDENTIALS = True
if not DEBUG:
    CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ORIGINS', '').split(',')

# ============================================================
# 通用配置
# ============================================================
LANGUAGE_CODE = 'zh-hans'
TIME_ZONE = 'Asia/Shanghai'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# 安全配置（生产环境）
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True

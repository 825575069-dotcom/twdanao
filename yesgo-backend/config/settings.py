"""
Django settings for YesGo 天网大脑后端 (第二层)
对齐《YesGo 平台架构设计 v1.1》

数据库模式（通过 DB_ENGINE 环境变量切换）：
  - sqlite：开发环境（零配置，即开即用）
  - mysql：生产环境（MySQL 8.0+）
  - postgresql：可选方案（PostgreSQL 多 Schema）
"""

from dotenv import load_dotenv
load_dotenv()

import os
import sys
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

# ============================================================
# 加载 .env 文件（生产环境）
# ============================================================
def _load_env_file(path: Path):
    """简单 .env 解析器，不依赖 python-dotenv"""
    if not path.exists():
        return
    try:
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key, _, value = line.partition('=')
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                # 不处理行内注释 — 密码等值可能含 # 字符
                if key and key not in os.environ:
                    os.environ[key] = value
    except Exception:
        pass

_load_env_file(BASE_DIR / '.env')

# ============================================================
# 环境检测
# ============================================================
DB_ENGINE = os.environ.get('DB_ENGINE', 'sqlite')  # sqlite | mysql | postgresql
DEBUG = os.environ.get('DEBUG', 'True').lower() in ('true', '1', 'yes')
SECRET_KEY = os.environ.get('SECRET_KEY', 'yesgo-tianwang-brain-secret-key-2026')
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '*').split(',')

# 短信验证码：True 时接口直接返回验证码（便于无短信通道时测试）；接入真实通道后改为 False
SMS_MOCK_MODE = os.environ.get('SMS_MOCK_MODE', 'True').lower() in ('true', '1', 'yes')

# MySQL 配置（从环境变量读取）
MYSQL_HOST = os.environ.get('MYSQL_HOST', '127.0.0.1')
MYSQL_PORT = os.environ.get('MYSQL_PORT', '3306')
MYSQL_DB = os.environ.get('MYSQL_DB', 'twdanao')
MYSQL_USER = os.environ.get('MYSQL_USER', 'root')
MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD', '')

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
    'apps.public_database',
    'apps.wecom',
    'apps.marketing_follow',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'middleware.tenant.TenantMiddleware',
    'apps.security.middleware.AuditMiddleware',
]

ROOT_URLCONF = 'config.urls'

# ============================================================
# MySQL 引擎适配
# ============================================================
if DB_ENGINE == 'mysql':
    try:
        import pymysql
        pymysql.install_as_MySQLdb()
    except ImportError:
        pass

# ============================================================
# 数据库配置（SQLite 开发 / MySQL / PostgreSQL 生产）
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
elif DB_ENGINE == 'mysql':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': MYSQL_DB,
            'USER': MYSQL_USER,
            'PASSWORD': MYSQL_PASSWORD,
            'HOST': MYSQL_HOST,
            'PORT': MYSQL_PORT,
            'OPTIONS': {
                'charset': 'utf8mb4',
                'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
            },
            'CONN_MAX_AGE': 600,
            'CONN_HEALTH_CHECKS': True,
        },
    }
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
    'ACCESS_TOKEN_LIFETIME': timedelta(days=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ISSUER': 'yesgo',
}

# ============================================================
# CORS
# ============================================================
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOW_CREDENTIALS = True
# 始终允许 X-Tenant-ID / X-Supplier-Token 自定义头，否则浏览器 CORS 预检失败 → "Load failed"
CORS_ALLOW_HEADERS = [
    'accept', 'authorization', 'content-type', 'user-agent',
    'x-csrftoken', 'x-requested-with', 'x-tenant-id', 'x-supplier-token',
]
if not DEBUG:
    _cors = os.environ.get('CORS_ORIGINS', 'https://twdanao.88yldh.com,https://twdanaob.88yldh.com,https://twdanaom.88yldh.com')
    CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors.split(',') if o.strip()]
    # 允许自定义租户头 X-Tenant-ID / X-Supplier-Token，否则浏览器 CORS 预检失败 → "Load failed"
    CORS_ALLOW_HEADERS = [
        'accept', 'authorization', 'content-type', 'user-agent',
        'x-csrftoken', 'x-requested-with', 'x-tenant-id', 'x-supplier-token',
    ]

# ============================================================
# 通用配置
# ============================================================
LANGUAGE_CODE = 'zh-hans'
TIME_ZONE = 'Asia/Shanghai'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# 站点基础 URL（用于无 request 上下文时构造绝对 URL，如 webhook handler）
SITE_BASE_URL = os.environ.get('SITE_BASE_URL', '')

# QiWe 企微网关全局配置（由管理后台 WecomGlobalConfig 动态覆盖）
QIWEI_GLOBAL_TOKEN = os.environ.get('QIWEI_GLOBAL_TOKEN', '')
QIWEI_GLOBAL_BASE_URL = os.environ.get(
    'QIWEI_GLOBAL_BASE_URL',
    'https://manager.qiweapi.com/qiwe/api/qw/doApi'
)

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# 安全配置（生产环境）
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    # 生产环境 MEDIA_ROOT 对齐 Nginx alias 路径
    MEDIA_ROOT = '/home/web/twdanao/yesgo-backend/media/'

# ============================================================
# 日志配置
# ============================================================
# Gunicorn 默认将 worker stderr 重定向到 gunicorn-error.log，
# 因此所有 handler 输出到 stderr 即可在 Gunicorn 日志中查看。
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{levelname}] {asctime} {name} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'stream': 'ext://sys.stderr',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        # 企微 Webhook 回调 — 关键调试日志
        'apps.wecom': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        # 营销跟客 — 事件分发 + AI 回复
        'apps.marketing_follow': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        # 其他 app 模块 — 默认 INFO
        'apps': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        # Django 自身
        'django': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}

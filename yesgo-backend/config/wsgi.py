"""
WSGI config for YesGo 天网大脑后端
"""
from dotenv import load_dotenv
load_dotenv()

import os
import sys
from django.core.wsgi import get_wsgi_application

# 将项目根目录加入 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 默认使用 MySQL 生产环境
os.environ.setdefault('DB_ENGINE', 'mysql')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()

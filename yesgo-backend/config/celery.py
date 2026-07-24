"""
Celery 异步任务配置
对齐架构文档第 5.4 章 —— 异步任务队列（Celery + Redis 替代 Kafka）


用法：
    # 启动 Worker
    celery -A config.celery worker -l info -Q default,memory,model

    # 启动 Beat（���时任务）
    celery -A config.celery beat -l info
"""

import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('yesgo')

# 从 Django settings 读取配置（前缀 CELERY_）
app.config_from_object('django.conf:settings', namespace='CELERY')

# 自动发现��有 Django app 下的 tasks.py
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """调试任务：打印当前 worker 信息"""
    print(f'Request: {self.request!r}')

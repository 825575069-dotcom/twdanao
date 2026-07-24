"""
Gunicorn 生产配置 — YesGo 天网大脑后端
"""
import multiprocessing
import os

# 监听地址和端口
bind = os.environ.get('GUNICORN_BIND', '127.0.0.1:3008')

# Worker 数量（CPU 核数 * 2 + 1）
workers = int(os.environ.get('GUNICORN_WORKERS', multiprocessing.cpu_count() * 2 + 1))

# Worker 类型
worker_class = 'sync'

# 每个 worker 处理 N 个请求后重启（防止内存泄漏）
max_requests = int(os.environ.get('GUNICORN_MAX_REQUESTS', 1000))
max_requests_jitter = int(os.environ.get('GUNICORN_MAX_REQUESTS_JITTER', 100))

# 超时配置
timeout = int(os.environ.get('GUNICORN_TIMEOUT', 60))
graceful_timeout = int(os.environ.get('GUNICORN_GRACEFUL_TIMEOUT', 30))
keepalive = int(os.environ.get('GUNICORN_KEEPALIVE', 5))

# 日志
accesslog = os.environ.get('GUNICORN_ACCESS_LOG', '/home/web/logs/gunicorn-access.log')
errorlog = os.environ.get('GUNICORN_ERROR_LOG', '/home/web/logs/gunicorn-error.log')
loglevel = os.environ.get('GUNICORN_LOG_LEVEL', 'info')
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# PID 文件
pidfile = '/home/web/run/gunicorn.pid'

# 守护进程
daemon = os.environ.get('GUNICORN_DAEMON', 'false').lower() == 'true'

# 用户
user = os.environ.get('GUNICORN_USER', 'root')
group = os.environ.get('GUNICORN_GROUP', 'root')

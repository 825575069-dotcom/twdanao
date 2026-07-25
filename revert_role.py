#!/usr/bin/env python3
import os, sys, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
os.environ.setdefault('DB_ENGINE', 'mysql')
os.environ.setdefault('MYSQL_HOST', '127.0.0.1')
os.environ.setdefault('MYSQL_PORT', '3306')
os.environ.setdefault('MYSQL_DATABASE', 'twdanao')
os.environ.setdefault('MYSQL_USER', 'root')
os.environ.setdefault('MYSQL_PASSWORD', 'YesGo@2026#Secure')

sys.path.insert(0, '/home/web/twdanao/yesgo-backend')
django.setup()

from apps.platform.models import Role

role = Role.objects.filter(name='管理员').first()
if role:
    print(f'Before: {role.name} => {role.permissions}')
    role.permissions = []
    role.save()
    print(f'After:  {role.name} => {role.permissions}')
else:
    print('Role not found')

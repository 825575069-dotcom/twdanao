#!/bin/bash
# ============================================================
# YesGo Docker 启动脚本
# 自动执行 migration → collectstatic → 启动服务
# ============================================================
set -e

echo "=== YesGo 天网大脑启动 ==="
echo "DB_ENGINE=${DB_ENGINE:-sqlite}"

# 等待 PostgreSQL 就绪
if [ "$DB_ENGINE" = "postgresql" ]; then
    echo "等待 PostgreSQL 就绪..."
    until pg_isready -h "${POSTGRES_HOST:-postgres}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-yesgo}" 2>/dev/null; do
        sleep 1
    done
    echo "PostgreSQL 已就绪"
fi

# 等待 Redis 就绪
if command -v redis-cli &> /dev/null; then
    echo "等待 Redis 就绪..."
    until redis-cli -h "${REDIS_HOST:-redis}" ping 2>/dev/null; do
        sleep 1
    done
    echo "Redis 已就绪"
fi

# 执行数据库迁移
echo "执行数据库迁移..."
python manage.py migrate --noinput

# 创建初始 Schema（PostgreSQL 多租户模式）
if [ "$DB_ENGINE" = "postgresql" ]; then
    echo "初始化租户 Schema..."
    python manage.py shell -c "
from config.tenant_schema import create_tenant_schema
for code in ['demo', 'pharma_a', 'pharma_b']:
    create_tenant_schema(code)
    print(f'  Schema tenant_{code} 已创建')
"
fi

# 导入种子数据（首次启动）
if [ "${LOAD_SEED_DATA:-false}" = "true" ]; then
    echo "导入种子数据..."
    python manage.py seed_data 2>/dev/null || echo "  跳过（无 seed_data 命令）"
fi

# 收集静态文件
echo "收集静态文件..."
python manage.py collectstatic --noinput 2>/dev/null || true

echo "=== 启动 $@ ==="
exec "$@"

#!/bin/bash
# ============================================================
# YesGo 天网大脑 — 一键部署脚本
# 支持：Docker Compose 部署、本地开发部署、数据库初始化
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

show_help() {
    echo "YesGo 天网大脑 — 部署脚本"
    echo ""
    echo "用法: ./deploy.sh <命令> [选项]"
    echo ""
    echo "命令:"
    echo "  docker-up      启动全栈服务（Docker Compose）"
    echo "  docker-down    停止全部服务"
    echo "  docker-build   重新构建镜像"
    echo "  docker-logs    查看服务日志"
    echo "  dev            本地开发启动（SQLite + Django runserver）"
    echo "  init-db        初始化数据库（migration + 种子数据）"
    echo "  create-tenant  创建新租户 Schema（需 PostgreSQL）"
    echo "  status         查看服务状态"
    echo "  help           显示帮助"
}

docker_up() {
    echo -e "${GREEN}=== 启动 YesGo 全栈服务 ===${NC}"
    
    # 检查 .env 文件
    if [ ! -f .env ]; then
        echo -e "${YELLOW}未找到 .env 文件，使用默认配置${NC}"
        cp .env.example .env
    fi

    docker compose up -d
    echo ""
    echo -e "${GREEN}=== 服务已启动 ===${NC}"
    echo "  API:     http://localhost:${NGINX_PORT:-80}/api/v1/"
    echo "  Health:  http://localhost:${NGINX_PORT:-80}/api/v1/health/"
    
    # 等待服务就绪
    echo "等待服务就绪..."
    for i in $(seq 1 30); do
        if curl -s http://localhost:${NGINX_PORT:-80}/api/v1/health/ | grep -q '"code":0'; then
            echo -e "${GREEN}✓ 服务已就绪${NC}"
            return 0
        fi
        sleep 1
    done
    echo -e "${YELLOW}⚠ 服务可能尚未完全就绪，请稍后检查${NC}"
}

docker_down() {
    echo -e "${YELLOW}=== 停止全部服务 ===${NC}"
    docker compose down
    echo -e "${GREEN}✓ 已停止${NC}"
}

docker_build() {
    echo -e "${GREEN}=== 重新构建镜像 ===${NC}"
    docker compose build --no-cache
    echo -e "${GREEN}✓ 构建完成${NC}"
}

docker_logs() {
    docker compose logs -f --tail=100 "${1:-}"
}

dev() {
    echo -e "${GREEN}=== 本地开发模式（SQLite） ===${NC}"
    
    # 确保使用托管 Python
    PYTHON="${WORKBUDDY_PYTHON:-/Users/chenshenghe/.workbuddy/binaries/python/envs/yesgo-backend/bin/python3}"
    
    if [ ! -f "$PYTHON" ]; then
        echo "安装依赖..."
        pip install -r requirements.txt
        PYTHON=python3
    fi

    export DB_ENGINE=sqlite
    export DEBUG=True
    export SECRET_KEY=dev-secret-key
    
    echo "执行 migration..."
    $PYTHON manage.py migrate --noinput

    echo ""
    echo -e "${GREEN}=== 启动开发服务器 ===${NC}"
    echo "  API: http://localhost:8000/api/v1/"
    echo "  API 测试: http://localhost:8000/api/v1/health/"
    
    $PYTHON manage.py runserver 0.0.0.0:8000
}

init_db() {
    echo -e "${GREEN}=== 初始化数据库 ===${NC}"
    PYTHON="${WORKBUDDY_PYTHON:-/Users/chenshenghe/.workbuddy/binaries/python/envs/yesgo-backend/bin/python3}"
    
    $PYTHON manage.py makemigrations --noinput
    $PYTHON manage.py migrate --noinput
    
    echo -e "${GREEN}✓ 数据库已初始化${NC}"
}

create_tenant() {
    TENANT_CODE="${1:-demo}"
    echo -e "${GREEN}=== 创建租户 Schema: tenant_${TENANT_CODE} ===${NC}"
    PYTHON="${WORKBUDDY_PYTHON:-/Users/chenshenghe/.workbuddy/binaries/python/envs/yesgo-backend/bin/python3}"
    
    $PYTHON manage.py shell -c "
from config.tenant_schema import create_tenant_schema, migrate_tenant_schema
schema = create_tenant_schema('${TENANT_CODE}')
print(f'✓ Schema {schema} 已创建')
"
}

status() {
    echo -e "${GREEN}=== YesGo 服务状态 ===${NC}"
    if command -v docker &> /dev/null; then
        docker compose ps 2>/dev/null || echo "Docker 服务未运行"
    fi
    
    # 检查本地服务
    if curl -s http://localhost:8000/api/v1/health/ &>/dev/null; then
        echo -e "${GREEN}✓ Django 开发服务器运行中 (localhost:8000)${NC}"
    fi
    if curl -s http://localhost:80/api/v1/health/ &>/dev/null; then
        echo -e "${GREEN}✓ Nginx 生产服务运行中 (localhost:80)${NC}"
    fi
}

# 主入口
case "${1:-help}" in
    docker-up)      docker_up ;;
    docker-down)    docker_down ;;
    docker-build)   docker_build ;;
    docker-logs)    docker_logs "${2:-}" ;;
    dev)            dev ;;
    init-db)        init_db ;;
    create-tenant)  create_tenant "${2:-}" ;;
    status)         status ;;
    help|--help|-h) show_help ;;
    *)
        echo -e "${RED}未知命令: $1${NC}"
        show_help
        exit 1
        ;;
esac

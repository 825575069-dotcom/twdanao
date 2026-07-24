#!/bin/bash
set -e
echo "=== YesGo 天网大脑 部署 $(date '+%Y-%m-%d %H:%M:%S') ==="

export DB_ENGINE=mysql MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_DB=twdanao MYSQL_USER=root MYSQL_PASSWORD='Root@B2b2#2026'
export PYTHONPATH=/home/web/twdanao/yesgo-backend
cd /home/web/twdanao
VENV=/home/web/twdanao/venv
BE=/home/web/twdanao/yesgo-backend

echo "[1/8] 拉取代码..."
git checkout -- . 2>/dev/null || true
git pull origin main 2>/dev/null || echo "  (git pull 跳过)"

[ -f "$BE/.env" ] || cp "$BE/.env.production" "$BE/.env"
sed -i 's/Django==.*/Django==5.2.0/' "$BE/requirements.txt"

echo "[2/8] Python 依赖..."
cd "$BE" && "$VENV/bin/pip" install -r requirements.txt -q

echo "[3/8] Django 迁移 + 静态文件..."
"$VENV/bin/python" manage.py migrate --noinput
"$VENV/bin/python" manage.py collectstatic --noinput

echo "[4/8] 构建前端桌面管理端..."
cd /home/web/twdanao/ai-employee-app
npm install --legacy-peer-deps --silent 2>/dev/null
npm run build:web
cp -r dist-web/* /home/web/twdanao/frontend/

echo "[5/8] 构建管理后台..."
cd /home/web/twdanao/yesgo-admin
npm install --silent 2>/dev/null
npx vite build
rm -rf /home/web/twdanao/admin/*
cp -r dist/* /home/web/twdanao/admin/

echo "[6/8] 更新 Nginx 配置..."
if [ -d /home/web/twdanao/deploy/nginx ]; then
    cp /home/web/twdanao/deploy/nginx/*.conf /etc/nginx/conf.d/
    nginx -t && nginx -s reload
else
    echo "  (未找到 deploy/nginx/，跳过 Nginx 配置更新)"
fi

echo "[7/8] 重启后端..."
pkill -9 -f gunicorn 2>/dev/null || true
sleep 1
rm -f /home/web/twdanao/run/gunicorn.pid
cd "$BE"
"$VENV/bin/gunicorn" config.wsgi:application \
  --bind 127.0.0.1:3008 \
  --workers 4 \
  --daemon \
  --pid /home/web/twdanao/run/gunicorn.pid \
  --access-logfile /home/web/logs/gunicorn-access.log \
  --error-logfile /home/web/logs/gunicorn-error.log \
  --pythonpath "$BE"
sleep 2
curl -s http://127.0.0.1:3008/api/v1/health/ && echo " 后端 OK" || echo " 后端异常!"

echo "[8/8] 重载 Nginx..."
nginx -s reload 2>/dev/null || nginx

echo ""
echo "=== 部署完成 ==="
echo "前端桌面端: https://twdanao.88yldh.com/"
echo "管理后台:   https://twdanao.88yldh.com/admin/"
echo "后端 API:   https://twdanaob.88yldh.com/api/v1/health/"
echo "H5 移动端:  https://twdanaom.88yldh.com/"

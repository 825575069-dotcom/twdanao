# 排查发现

- 前端 `web/src/features/realtime/session.ts` 默认将实时地址构造成同源 `/ws`，并在 URL 中写入当前作用域的访问令牌和 `scope`。
- `server/yesgo/asgi.py` 只创建 Django HTTP ASGI application，未配置 WebSocket 路由或 consumer；`INSTALLED_APPS` 也未包含 Channels。
- `docker/nginx/local.yesgo.86lw.cc.conf` 仅将 `/api/` 转发到 Django；`/ws` 会命中通用 `/` 规则并被转发到 Vite（5173），而不是 WebSocket 服务。
- `server/yesgo/urls.py` 仅声明 HTTP API 路由。

## 待验证假设

前端实时会话已被接入应用启动流程，但对应服务端实时端点尚未部署，因此浏览器连接到同源 `/ws` 必然失败。应仅在部署显式提供 WebSocket 地址时才连接。

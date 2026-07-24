# 调研发现

- 当前前端已有 WebSocket 客户端、事件信封和重连基础，但没有心跳或失败提示。
- `server/yesgo/asgi.py` 目前仅运行 Django HTTP ASGI application。
- `docker/backend.Dockerfile` 使用 `runserver`，未安装 Channels/Redis 通道层依赖。
- Nginx 未配置 `/ws`，通用路径会转发给 Vite。
- 前端 Vite 开发容器没有继承根目录 `.env` 的 `VITE_WS_BASE_URL`，Compose 需显式传入。
- 现有 token service 可验证 access token、黑名单、会话以及账号状态，适合作为 consumer 握手鉴权基础。

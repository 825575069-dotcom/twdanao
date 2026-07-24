# 发现

- 本地 `server/api/shared/urls.py` 与两个必要的 `__init__.py` 均存在。
- `server/yesgo/urls.py` 正确包含 `api.shared.urls`。
- 常规 `docker/backend.Dockerfile` 没有 `COPY server`，依赖 Compose 的 `../server:/app/server` 运行时挂载。
- 用户堆栈来自容器 `/app/server`，故需继续确认实际启动服务与其源码装载边界。
- WSL2 部署计划明确要求 `backend.Dockerfile` 复制 `server/`，而当前文件遗漏了该步骤；同一计划中的 `worker.Dockerfile` 已正确包含 `COPY server /app/server`。
- 假设：为 backend 镜像补齐相同的源码复制可消除其对运行时挂载的单点依赖，并与既有部署设计一致。

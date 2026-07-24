# 调研发现

- 既有 `apps.observability.SystemLog` 已用于运行诊断、堆栈与问题单，不能复用为操作审计。
- 总控与租户菜单均有“操作日志”占位项；总控路径为 `/platform/log/operation`。
- Django 目前只有 `TenantContextMiddleware`；认证在 DRF 的 `ControlBearerAuthentication` / `TenantBearerAuthentication` 中完成。
- API 使用 `{ code, msg, data }` 统一响应；现有业务码足够，不需新增业务码。
- 用户确认采用“HTTP 自动采集 + 领域服务可补充上下文”的方案，日志仅供总控查询。
- `SharedBearerAuthentication` 会在 DRF 请求对象上设置 `request.user`、`control_account` 或 `tenant_account`；操作日志中间件需在响应后从底层 Django request 读取该主体，并以集成测试验证可见性。
- 当前前端文件命名与初步假设不一致：不存在 `web/src/views/control/LoginLogView.vue` 或 `web/src/api/control.ts`；实施计划必须以实际的路由模块、`web/src/api/` 文件和现有登录日志页面为准。

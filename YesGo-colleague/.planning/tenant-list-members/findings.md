# 调研结论

- `web/src/views/control/TenantListView.vue` 已接入真实租户列表接口，但操作仅有编辑，成员页面仍使用 `controlResourceRegistry.ts` 静态演示数据。
- 总控路由已有 `/platform/tenant/member` 与详情路由，详情复用通用资源占位页。
- 后端租户接口位于 `server/apps/platform/views.py`，标准响应由 `StandardizedApiMixin` 提供。
- 成员模型为 `server/apps/iam/models.py` 中的 `TenantUser`、`TenantUserRole`，角色模型为 `TenantRole`。

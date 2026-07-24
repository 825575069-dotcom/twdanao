# 调研记录

- 用户已确认总控及租户的权限管理、角色管理、部门管理均只允许各自超级管理员使用。
- 直接通过 URL 访问必须由前端路由守卫拦截；后端接口同时拒绝越权访问。
- 员工管理操作入口文案从“授权”调整为“角色”。
- 员工列表操作、授权弹窗、角色分配详情路由均沿用“授权”文案；列表操作在 `web/src/views/control/ControlStaffManagementView.vue`。
- 总控菜单键为 `control-permission-departments`、`control-permission-roles`、`control-permission-menus`，子路由目前仅标记 `authScope` 与 `menuKey`，`authGuard.ts` 只校验令牌。
- 现有总控权限 API 使用 `IsPlatformAdmin`，该类允许任意已认证的控制端账号，因此与“仅超级管理员”要求不一致；模型已有 `is_super_admin` 字段。
- 用户确认：`TenantUser` 增加并统一使用 `is_super_admin` 字段；现有 `tenant_admin` 角色不再作为超级管理员身份判定来源。
- 字段使用项目既有 `UnsignedTinyIntegerField`，读取值为 `0/1`，测试应断言数值而非 Python `is False`。

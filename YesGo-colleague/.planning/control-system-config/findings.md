# 调研发现

1. 当前总控“系统设置”菜单 `control-system-settings` 在菜单树中存在，但路由组件未单独实现，当前真正已接入的配置页是 `control-system-integrations`，对应页面为 `web/src/views/control/TenantSiteConfigView.vue`。
2. `web/src/views/control/TenantSiteConfigView.vue` 实际是“租户站点配置”，包含租户选择、域名、Logo、主题色等租户级字段，不符合“系统级配置”定位。
3. 总控“集成配置”当前分散在以下位置：
   - 菜单：`web/src/layouts/pro/menu.ts`
   - 路由：`web/src/router/modules/control.ts`
   - 权限常量/种子：`server/apps/iam/constants.py`、`server/apps/iam/services.py`
   - 前端测试：`web/src/tests/layouts.spec.ts`
   - 后端权限测试：`server/tests/test_control_permission_api.py`
4. 代码检索结果未发现现成的 `system_config` 领域模型，需要按领域规则新增系统级配置能力。

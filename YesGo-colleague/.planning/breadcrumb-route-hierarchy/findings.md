# 调研记录

- `web/src/layouts/pro/ProAdminLayout.vue` 当前将 `breadcrumbRoot` 与 `currentTitle` 固定渲染为两级；`breadcrumbRoot` 已被现有改动删除，造成构建错误和页面出现 `/`。
- `web/src/router/modules/control.ts` 定义了 `/platform/tenants` 列表路由与 `tenants/:id` 详情子路由，详情标题为“租户详情”。
- 用户期望列表页不显示虚假的根路径；详情页显示“租户列表 / 租户详情”。
- 详情页的 `menuKey` 为 `control-tenant-list`，可直接通过既有菜单定义得到父级标题“租户列表”，无需复制路由映射。
- 浏览器刷新后的 DOM 与截图均显示列表页面包屑只有“租户列表”，不再显示 `/`。
- 浏览器在定位首行“编辑”按钮时超时重置；详情页层级由新增布局测试覆盖，未重复尝试相同浏览器动作。

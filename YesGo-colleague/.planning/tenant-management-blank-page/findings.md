# 调研记录

- 侧边栏“租户成员”菜单路由为 `/platform/tenant/member`，页面组件为 `ControlTenantMemberListView.vue`。
- 本次会同时检查与该菜单同属租户管理入口的路由配置和懒加载模块。
- 本地浏览器直接访问成员路由会被认证守卫重定向至总控登录页，无法在无登录态会话中复现用户所见空白；控制台未记录页面脚本错误。
- 路由模块已为 `control-tenant-list` 和 `control-tenant-member` 明确配置独立组件，基础路由映射本身未见缺失。
- Chrome 当前无 YesGo 已登录标签页，不能复用用户登录态验证。
- 根因已由回归测试证实：`fetchPlatformTenants()` 被拒绝时，`ControlTenantMemberListView` 的挂载钩子出现未处理拒绝（Vitest 报 `Unhandled error during execution of mounted hook`）。`TenantListView` 使用同一未保护请求，也存在同类风险。
- 修复：成员页的租户选项加载和租户列表加载均在失败时回退到空数组，保证挂载钩子正常结束。
- 后端权限种子 `server/apps/iam/services.py` 为 `control-tenant-list` 明确配置 `route_path="/control/tenant/list"`；但前端仅注册 `/platform/tenant`，造成 Vue Router 的“No match found”警告。这是当前无法打开列表的直接根因。
- 用户已确认租户反馈不兼容旧地址：`/control/tenant/feedback` 是唯一正式路径。当前前端菜单、Vue Router 和后端权限种子均仍为 `/platform/tenant/feedback`，必须同步替换，且路由构建逻辑需要能保留 `/control/` 前缀。
- 继续审计发现：初始化与后端种子已经对列表、成员、套餐使用 `/control/tenant/*`，静态菜单、详情路由、列表页跳转和多标签/面包屑测试仍留在 `/platform/tenant/*`。仅修复列表会留下成员、套餐和详情入口的空白风险，应统一整条总控租户管理路由层级。

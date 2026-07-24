# 调研发现

- `TenantListView.vue` 已是专用总控租户页面，平台 API 位于 `web/src/api/platform.ts` 与 `server/apps/platform/views.py`。
- `control-tenant-member` 当前指向 `ControlResourceListView.vue`，其成员记录来自 `controlResourceRegistry.ts` 的模拟数据。
- 成员主体为 `apps.iam.models.TenantUser`，租户角色关联为 `TenantUserRole` 与 `TenantRole`。
- 路由已存在成员详情路径；本阶段仅保留跳转入口，不实现详情读取与编辑。
- `web/src/api/platform.ts` 已预留 `fetchControlTenantMembers` 等成员接口函数，但当前总控成员路由仍使用模拟列表页；应复用列表函数，不实现其余写接口。
- `TenantListView.vue` 当前在浏览器端对已加载的租户做筛选，已有 ID 列、默认后端倒序、空状态由 `StandardListTable` 统一处理。
- `ControlTenantMemberListView` 已有真实 API、详情及写接口，因此本阶段只创建专用列表页面，不重复构建成员写能力。
- `TenantUser.active_mobile_key` 在同一租户内唯一，成员筛选测试需使用不同手机号来验证模糊匹配和倒序。
- `StandardListTable` 已统一实现 ID 列展示、刷新、搜索、重置、操作列及“暂无数据”空状态。

## 错误

- 首次读取时误查 `server/apps/iam/urls.py`；该项目的总控入口实际位于 `server/api/control/iam/urls.py`，后续按入口层目录继续勘查。

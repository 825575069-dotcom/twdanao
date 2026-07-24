# 总控与租户 RBAC 发现记录

## 2026-07-09 初步现状

- 仓库已有总控 RBAC 后端模型：`server/apps/iam/models.py` 包含 `ControlDepartment`、`ControlUser`、`ControlRole`、`ControlPermission`、`ControlRolePermission`、`ControlUserRole`。
- 总控 RBAC API 已挂在 `server/api/control/iam/urls.py`，包括 `/api/control/me/`、`/api/control/me/menus/`、`/api/control/permissions/`、`/api/control/roles/`、`/api/control/staff/`、`/api/control/departments/`、`/api/control/login-logs/`。
- 后端已有 `server/tests/test_control_rbac_api.py`，覆盖角色权限读取与替换、角色菜单绑定、角色列表和创建、部门树与增删改、员工创建更新、员工角色分配、员工列表、软删除等场景。
- 前端已有总控 RBAC 页面：`web/src/views/control/ControlRoleManagementView.vue`、`ControlRoleDetailView.vue`、`ControlStaffManagementView.vue`、`ControlStaffDetailView.vue`、`ControlStaffRoleAssignmentView.vue`、`ControlPermissionManagementView.vue`、`ControlDepartmentManagementView.vue` 等。
- 前端总控路由 `web/src/router/modules/control.ts` 已出现菜单 key 到页面组件的映射，例如 `control-permission-staff` 和 `control-permission-roles`。
- 当前工作区已有未提交改动，包含 `AGENTS.md`、多个迁移文件、`server/tests/test_rebuild_initial_mysql_schema_command.py` 和 `.planning/`，后续不得回滚无关改动。

## 待确认缺口

- 已确认第一阶段只完成“超级管理员配置 RBAC + 菜单按角色显示”，普通总控用户 API 级权限拦截暂不进入第一阶段。
- 总控权限树是否以菜单权限为主，按钮和 API 权限是否本阶段进入可配置和可执行拦截。
- 已添加后端一致性测试，要求 `seed_control_permissions` 的菜单种子 code 与 `CONTROL_MENU_KEYS` 对齐。
- 租户 RBAC 是否本轮只做设计和预留，还是在总控完成后立刻进入实现。

## 2026-07-09 修复发现

- `web/src/layouts/pro/ProAdminLayout.vue` 存在开发期 `DEV_ALWAYS_VISIBLE_KEYS`，会让 `control-log-login` 在后端 RBAC payload 未授权时仍显示。
- 新增前端测试后先失败，失败文本包含“日志管理/登录日志”；删除临时白名单后 `web` 的 `layouts.spec.ts` 17 个测试通过。
- `server/tests/test_control_permission_api.py` 新增一致性测试后通过，说明当前后端种子和 `CONTROL_MENU_KEYS` 已经对齐。

## 2026-07-09 四个入口 CRUD 体检

- 员工入口已有列表、新增、编辑、查看、软删除和角色授权前端入口；后端已有 `GET/POST/PATCH/DELETE /api/control/staff/`。问题点：员工列表展示 `email`，但后端 `ControlStaffSerializer` 与 `_build_payload` 未返回 `email`；员工编辑通过拉全量列表找详情，不是独立详情接口。
- 部门入口已有列表、新增、编辑、删除；后端已有 `GET/POST/PATCH/DELETE /api/control/departments/`。问题点：没有独立只读查看路由；删除未做前端确认和后端子部门保护策略确认。
- 角色入口已有列表、新增和编辑，但列表只有“编辑”动作；后端 `ControlRoleDetailView` 只有 `PATCH`，缺 `GET` 详情和 `DELETE`。问题点：新增路由复用 `permission/roles/:id` 的 `new` 参数，能工作但不够显式；删除能力缺失；查看模式缺失。
- 权限入口已有列表、新增和编辑；后端 `ControlPermissionDetailView` 有 `GET/PATCH`，但需要确认是否有 `DELETE`。前端列表只有“编辑”，缺查看和删除动作；详情页没有只读模式。
- 四个入口动作不统一：员工有“编辑/授权角色/删除/查看已删除”，部门有“编辑/删除”，角色和权限仅“编辑”。应统一为列表行提供“查看、编辑、删除”，员工额外保留“授权角色”。
- 保存后行为不一致：部门和员工保存后返回列表；权限新增返回列表但编辑停留；角色保存后停留且不提示。建议统一保存成功提示，并返回列表或留在详情需要明确。
- 前端表单规范新增约束：枚举类、单选型字段若可选项不超过 5 个，统一用单选框/单选组，不要用下拉框。该规则会直接影响角色数据范围、状态、可见性等控件形态。
- 列表展示补充规范：默认展示 `ID` 字段，且默认按 `id` 倒序；如果某个列表有业务排序要求，必须显式声明，不要依赖框架默认顺序。
- 列表操作按钮补充规范：主动作高亮、次动作普通、危险动作红色；同一列表内动作顺序和视觉层级必须保持一致。

## 2026-07-09 文档与租户请求头对齐

- 当前现行文档中 `README.md`、`AGENTS.md`、`docs/deployment/本地部署与验收.md`、`docs/database/数据库设计规范.md`、`docs/design-static/platform-overview-static.html` 仍有“三大智能体/三套工作流”旧口径，需要统一到五大智能体：`procurement`、`operations`、`marketing`、`distribution`、`academic`。
- 后端运行时视图、中间件和测试已统一读取 `X-Tenant-ID`，但前端 `web/src/api/http.ts` 在本轮修复前仍发送 `X-Tenant-Code`，存在真实接口契约错位。
- `web/src/stores/auth.ts` 与 `web/src/views/auth/TenantLoginView.vue` 已具备从登录响应持久化 `tenant_id` 的条件，补齐本地存储后即可让租户 API 请求头与后端保持一致。
- `docs/deployment/本地部署与验收.md` 在本轮修复前仍将已作废的 `tenantops_tenant_agent_config`、`procurement_agent_procurement_task` 作为必查表，已改为当前仍在初始化 SQL 中存在的 `agent`、`division` 等表。
## 2026-07-09 控制台接口标准响应补齐

- `/api/platform/tenants/` 使用 DRF `ListCreateAPIView` / `RetrieveUpdateAPIView` 直接返回 serializer 数据，成功响应未走 `code/msg/data` 标准外壳。
- `/api/control/me/menus/` 成功响应已手工包壳，但认证或权限异常仍会回落到 DRF 默认 `detail` 响应体。
- `server/yesgo/settings.py` 当前没有配置全局 `EXCEPTION_HANDLER`，本轮不做全局改造，避免波及大量既有测试。
- 本轮采用局部收口：在 `apps.common.views` 增加 `StandardizedApiMixin`，仅给 `TenantListCreateView`、`TenantDetailView`、`ControlCurrentMenuView` 接入标准成功/异常封装。
- 后端标准化后，前端 `web/src/api/http.ts` 需要同时识别标准错误壳里的 `msg` 和 `data.detail`，并兼容 `"Token has expired."` 末尾标点。
- `fetchPlatformTenants()` 的消费点位于 `TenantListView.vue`、`ControlTenantDetailView.vue`、`PlatformOverviewView.vue`、`TenantSiteConfigView.vue`，后端改成标准成功壳后，这四处都要做 `data.data ?? data` 解包。

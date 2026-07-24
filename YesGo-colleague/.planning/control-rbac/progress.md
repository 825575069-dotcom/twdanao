# 总控与租户 RBAC 进度

## 2026-07-09

## 2026-07-10 标准列表操作菜单

- 用户确认所有标准列表统一采用参考图风格的“更多”悬浮菜单。
- 用户补充全局规范：同一记录的查看和编辑入口不共存，有编辑能力时优先编辑，仅只读时显示查看。
- 已确认现状：`StandardListTable` 使用原生 `details`；员工、部门、角色、权限列表均存在查看/编辑重复声明。
- 已编写实施计划 `docs/superpowers/plans/2026-07-10-standard-list-more-menu.md`，准备按 TDD 执行。
- `subagent-driven-development/scripts/task-brief` 因当前 PowerShell 环境没有 `bash` 无法运行，已按脚本输出格式手工生成等价任务简报，后续不重复尝试该命令。
- Task 1 组件测试通过 `11/11`，独立复核确认外部关闭、单菜单互斥、蓝色触发器和红色危险项符合规格。
- Task 2 页面测试先得到 `4 failed / 38` 的预期红灯，清理动作后 `38/38` 通过；补齐 dropdown/menu 测试桩后不再出现相关 Vue resolve warn，独立复核通过。
- 继续完善总控角色权限详情页交互：新增按 `菜单权限 / 按钮权限 / 接口权限` 分区展示。
- 继续完善角色权限可读性：新增分区 `selectedCount/totalCount` 统计计算，以及父节点 `checked/partial/unchecked` 半选态计算。
- 定向前端验证：`cd web; yarn test -- --runInBand src/tests/control-pages.spec.ts` 通过，`40 tests passed`。
- 继续将半选态从内部计算落到 UI 文案：父节点在子节点单独选中时展示 `部分已选`。
- 定向前端验证：`cd web; yarn test -- --runInBand src/tests/control-pages.spec.ts` 通过，`39 tests passed`。
- 从中断会话 `019f45dc-6c15-7dd1-91a9-d7bc19ae1b86` 恢复，优先核对 `.planning/.active_plan`、`task_plan.md`、`progress.md` 和工作区改动，确认主线为标准列表菜单收尾加总控系统设置页验收，而非新的 RBAC 范围变更。
- 恢复后先做定向验证：`cd server; ..\.venv\Scripts\python.exe -m pytest tests/test_platform_system_config_api.py -q` 通过，`5 passed`。
- 恢复后继续做定向前端验证：`cd web; yarn.cmd test src/tests/standard-list-table.spec.ts --runInBand` 通过，`19 tests passed`；`cd web; yarn.cmd test src/tests/control-pages.spec.ts --runInBand` 通过，`41 tests passed`。
- 确认 `StandardListTable` 当前实现已覆盖危险操作二次确认、列设置浮层和拖拽排序；系统设置接口与页面联调所需的后端枚举校验、前端路由和测试桩均已在工作区中。
- 完成前全量验证：`cd server; ..\.venv\Scripts\python.exe -m pytest -q` 通过，`219 passed in 30.79s`。
- 完成前迁移检查：`cd server; $env:DJANGO_SECRET_KEY='test-secret'; ..\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run` 输出 `No changes detected`。
- 完成前前端全量：`cd web; yarn.cmd test -- --runInBand` 通过，`21 files / 138 tests passed`；期间仍有既有 `a-radio-group` test stub 缺失导致的 Vue warn，但不影响退出码和断言结果。
- 完成前前端构建：`cd web; yarn.cmd build` 通过，新增 `ControlSystemSettingsView` 与 `StandardListTable` 产物构建成功；仍保留既有 Vite chunk size warning，退出码 `0`。
- 继续恢复时补做浏览器验收准备：确认 `127.0.0.1:8000` 与 `127.0.0.1:5173` 均可连通，说明后端 API 和 Vite dev server 在本地都已运行。
- 尝试使用 Node REPL + Playwright 做真实页面点击验收时，运行时缺少 `playwright-core` 依赖链，未继续临时安装外部依赖，避免引入新的环境变量和审批成本。
- 改用现有任务记录与本地 HTTP 探测组合补证：读取中断会话 `019f45dc-6c15-7dd1-91a9-d7bc19ae1b86` 的最近记录，确认上一轮已完成 `StandardListTable` 拖拽列排序、前端全量测试和构建收尾。
- 本地 HTTP 探测：`Invoke-WebRequest http://127.0.0.1:5173/platform/system/settings` 与 `Invoke-WebRequest http://127.0.0.1:5173/platform/permission/staff` 均返回 `200`，HTML 入口正常包含 Vite client 和 `src/main.ts`，说明两个目标路由在当前 dev server 下可访问。

- 启用 `superpowers:brainstorming`，因本次为跨模型、接口、页面和权限策略的功能目标，必须先确认设计。
- 启用 `planning-with-files`，建立 `.planning/control-rbac/` 持久计划。
- 读取现有总控 RBAC 相关测试、模型、URL 和部分 view/service/frontend 路由线索。
- 确认现有实现不是从零开始，仓库中已有总控 RBAC 骨架和测试覆盖。
- 将 `.planning/.active_plan` 切换到 `control-rbac`。
- 用户确认第一阶段范围：总控超级管理员配置闭环 + 菜单按角色展示，注意复用既有穿插实现。
- 写入设计规格 `docs/superpowers/specs/2026-07-09-control-rbac-phase1-design.md`。
- 写入实现计划 `docs/superpowers/plans/2026-07-09-control-rbac-phase1.md`。
- TDD 修复前端总控菜单临时白名单：先让 `layouts.spec.ts` 因“日志管理”未授权仍显示失败，再删除 `DEV_ALWAYS_VISIBLE_KEYS`。
- 验证 `cd web; yarn.cmd test layouts.spec.ts --runInBand` 通过，17 tests passed。
- 添加后端种子一致性测试，验证 `CONTROL_MENU_KEYS` 与菜单种子 code 对齐。
- 验证 `cd server; ..\.venv\Scripts\python.exe -m pytest tests/test_control_permission_api.py -q` 通过，11 tests passed。
- 全量后端验证 `cd server; ..\.venv\Scripts\python.exe -m pytest -q` 通过，207 passed。
- 迁移检查 `cd server; $env:DJANGO_SECRET_KEY='test-secret'; ..\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run` 通过，输出 `No changes detected`。
- 前端全量测试 `cd web; yarn.cmd test -- --runInBand` 通过，20 files / 107 tests passed。
- 前端构建 `cd web; yarn.cmd build` 通过，Vite 输出 chunk size warning，但退出码为 0。
- 修复构建期类型问题：`fetchSiteContext` 类型兼容标准响应外壳和旧裸对象，`rootEntry`/`siteStore` 做类型收窄，`http-auth-expired.spec.ts` 对 Axios response interceptor 做非空断言。
- `git status --short` 显示本次改动外仍有 README、数据库/部署文档、`docs/sql.md` 删除和 `.planning/mysql-division-init` 等既有无关改动，未回滚。
- 根据用户反馈“四个入口新增、删除、编辑、查看还有各种问题”，完成员工、部门、角色、权限四个入口体检。
- 当前缺口集中在角色/权限缺删除和查看、员工后端缺 `email` 返回、四个入口动作和保存行为不统一、部分详情通过列表查找而非详情接口。
- 用户补充前端规范：枚举类、单选型字段若可选项不超过 5 个，统一改为单选框/单选组，不使用下拉框。
- 用户补充列表规范：列表默认展示 `ID` 字段，且默认按 `id` 倒序。
- 用户补充按钮规范：列表操作按钮统一为主动作高亮、次动作普通、危险动作红色。
- 按用户要求更新 `README.md`，将平台口径统一为五大智能体，并同步五套 Dify 平台级工作流与初始化说明。
- 同步修正 `AGENTS.md`、`docs/deployment/本地部署与验收.md`、`docs/database/数据库设计规范.md`、`docs/design-static/platform-overview-static.html` 的五大智能体、`X-Tenant-ID` 和废弃表名口径。
- 修复前端租户请求头契约：`web/src/stores/auth.ts` 增加 `yesgo.tenant.id` 持久化，`web/src/views/auth/TenantLoginView.vue` 登录成功后写入 `tenant_id`，`web/src/api/http.ts` 对租户 API 改发 `X-Tenant-ID`。
- 为租户请求头回归补测试：`web/src/tests/http-auth-expired.spec.ts` 新增 `X-Tenant-ID` 透传断言，并验证鉴权过期时清理 `yesgo.tenant.id`。
- 重新验证后端：`pytest -q` 通过，`207 passed, 1 warning in 25.19s`；迁移检查通过，输出 `No changes detected`。
- 首次前端复验中，`yarn build` 先报 `site.ts` 联合类型收窄和 Axios headers 类型错误；修复后再次运行 `corepack yarn test -- --runInBand` 通过，`20 files / 108 tests passed`。
- 最终前端构建 `corepack yarn build` 通过，Vite 仍提示大 chunk warning，但退出码为 `0`，属于既有构建提示而非失败。
- 根据用户反馈 `/api/platform/tenants/` 与 `/api/control/me/menus/` 返回异常且消息体不标准，按 `systematic-debugging + TDD` 先补失败测试。
- 后端红灯：`test_platform_tenant_api.py`、`test_platform_tenant_list_api.py`、`test_control_rbac_api.py` 新增标准成功外壳和异常外壳断言，首次得到 `8 failed, 21 passed`。
- 前端红灯：`src/tests/http-auth-expired.spec.ts` 新增标准错误壳下登录过期跳转断言，首次失败，确认拦截器只识别裸 `detail`。
- 在 `server/apps/common/views.py` 新增 `StandardizedApiMixin`，封装 `success_response`、`wrap_success_response` 与局部 `handle_exception` 标准化逻辑。
- 将 `server/apps/platform/views.py` 的 `TenantListCreateView`、`TenantDetailView` 接入局部标准响应封装，将 `server/apps/iam/views.py` 的 `ControlCurrentMenuView` 改为复用标准成功响应。
- 更新 `web/src/api/http.ts`，让登录过期识别兼容标准错误壳的 `msg` / `data.detail`，并忽略 `Token has expired.` 末尾标点差异。
- 更新 `web/src/views/control/TenantListView.vue`、`ControlTenantDetailView.vue`、`PlatformOverviewView.vue`、`TenantSiteConfigView.vue`，兼容 `fetchPlatformTenants()` 返回标准外壳。
- 回归验证 1：`cd server; ..\.venv\Scripts\python.exe -m pytest tests/test_platform_tenant_api.py tests/test_platform_tenant_list_api.py tests/test_control_rbac_api.py -q` 通过，`29 passed in 2.01s`。
- 回归验证 2：`cd web; yarn.cmd test src/tests/http-auth-expired.spec.ts --runInBand` 通过，`3 passed`。
- 后端全量验证：`cd server; ..\.venv\Scripts\python.exe -m pytest -q` 通过，`211 passed in 34.04s`。
- 迁移检查：`cd server; $env:DJANGO_SECRET_KEY='test-secret'; ..\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run` 输出 `No changes detected`。
- 前端全量验证：`cd web; yarn.cmd test -- --runInBand` 通过，`20 files / 109 tests passed`。
- 前端构建：`cd web; yarn.cmd build` 通过，仍有既有 Vite chunk size warning，但退出码为 `0`。
- 从崩溃会话 `019f4581-268d-7093-a138-5b90070b94e1` 恢复未完成事项，确认半截改动集中在角色/权限 CRUD 与标准错误码断言。
- 按 TDD 补后端红灯：角色详情 `GET` / 角色 `DELETE`、权限 `DELETE`；初次精确验证得到角色详情 `405`、权限测试缺 `ControlRolePermission` 导入。
- 实现后端角色详情和删除、权限删除；角色列表改为 `id` 倒序并复用 payload builder；精确后端验证 `2 passed`。
- 补前端红灯：角色/权限列表展示 `ID`，动作统一为 `查看/编辑/删除`，危险动作为红色；角色/权限详情支持 `mode=view` 只读态。
- 实现前端 `fetchControlRoleDetail`、`deleteControlRole`、`deleteControlPermission` wrapper；角色详情改用独立详情接口；角色/权限详情保存按钮在只读态隐藏。
- 落实用户枚举控件规范：角色数据范围/状态、权限类型/是否可见/状态改用 `a-radio-group`。
- 精确前端验证 `cd web; yarn.cmd test src/tests/control-pages.spec.ts --runInBand` 通过，`35 tests passed`。
- 后端组合验证发现恢复会话中的过期 token 断言应为认证错误 `ApiBusinessCode.UNAUTHORIZED=1002`，不是权限不足 `1003`；已按 `standardize_error_response` 映射语义修正测试。
- 全局 `EXCEPTION_HANDLER` 接入后，旧后端测试中裸 `detail` 和裸 serializer 错误断言同步到标准错误外壳；针对旧契约失败文件复跑 `44 passed`。
- 完成前验证：后端全量 `cd server; ..\.venv\Scripts\python.exe -m pytest -q` 通过，`213 passed in 23.18s`。
- 完成前验证：迁移检查 `cd server; $env:DJANGO_SECRET_KEY='test-secret'; ..\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run` 输出 `No changes detected`。
- 完成前验证：前端全量 `cd web; yarn.cmd test -- --runInBand` 通过，`20 files / 113 tests passed`。
- 完成前验证：前端构建 `cd web; yarn.cmd build` 通过，仍有既有 Vite chunk size warning，退出码 `0`。
- 按用户确认继续推进“错误响应标准”后，接入全局 `REST_FRAMEWORK.EXCEPTION_HANDLER`，统一将裸 `detail` 转为标准业务响应外壳，并新增 `ApiBusinessCode` 常量。
- 业务码规则本轮落地为：成功 `0`，参数错误 `1001`，认证失败 `1002`，权限不足 `1003`，未找到 `1004`，冲突 `1005`，服务不可用 `1006`。
- 将 `detail` 从错误响应 `data` 中移除，仅保留字段级校验错误字典；纯消息型错误改为 `msg=<错误文案>, data={}`。
- 同步修复 `web/src/api/control-rbac.ts` 缺少 `deleteControlRole` 导出，以及 `web/src/views/control/ControlRoleManagementView.vue` 的 `openRoleDetail` 参数签名不匹配，前端构建阻塞解除。
- 定向后端验证：`cd server; ..\\.venv\\Scripts\\python.exe -m pytest tests/test_auth_api.py tests/test_agent_config_api.py tests/test_procurement_task_api.py tests/test_system_monitoring_api.py tests/test_workbench_contract_api.py tests/test_platform_tenant_api.py tests/test_control_rbac_api.py tests/test_control_permission_api.py -q` 通过，`77 passed in 12.90s`。
- 最终后端全量验证：`cd server; ..\\.venv\\Scripts\\python.exe -m pytest -q` 通过，`211 passed in 32.53s`。
- 最终迁移检查：`cd server; $env:DJANGO_SECRET_KEY='test-secret'; ..\\.venv\\Scripts\\python.exe manage.py makemigrations --check --dry-run` 输出 `No changes detected`。
- 最终前端全量验证：`cd web; yarn.cmd test -- --runInBand` 通过，`20 files / 113 tests passed`。
- 最终前端构建：`cd web; yarn.cmd build` 通过，保留既有 Vite chunk size warning，退出码 `0`。

## 2026-07-09 崩溃恢复补充

- 部门管理主按钮保持为 `新增`，并补测试防止回退到 `新增部门`。
- RBAC 部门、员工、角色、权限列表通过 `unwrapControlList` 兼容 `{ code,msg,data:{results:[]} }` 标准分页外壳读取数据。
- 修复 `control-staff-soft-delete.spec.ts` 与 `list-search-ui.spec.ts` 的 `control-rbac` mock 缺少 `unwrapControlList` / `unwrapControlPayload` 导出。
- 放宽 `control-pages.spec.ts` 分页响应 mock 类型，解除 `results` 构建类型错误。
- 定向验证：`cd web; yarn.cmd test src/tests/control-staff-soft-delete.spec.ts src/tests/list-search-ui.spec.ts src/tests/control-pages.spec.ts --runInBand` 通过，`3 passed / 43 tests passed`。
- 前端全量验证：`cd web; yarn.cmd test -- --runInBand` 通过，`20 passed / 114 tests passed`。
- 前端构建验证：`cd web; yarn.cmd build` 通过，`vue-tsc` 与 Vite 构建退出码 `0`，仅保留既有 chunk size warning。

## 2026-07-09 Invalid token 修复

- 复现问题：列表接口返回 `{"code":1001,"msg":"Invalid token.","data":{}}` 时，前端没有按登录失效处理，导致列表页直接展示错误。
- 根因：`SharedBearerAuthentication.authenticate` 未捕获 `decode_token` 抛出的 `ValidationError`，统一错误处理将其归类为 `INVALID_PARAMS=1001`；前端 `isAuthExpired` 也只识别 `Token has expired`。
- 修复：后端将坏 token 转为 `AuthenticationFailed`；前端同时识别标准外壳中的 `Invalid token.` 并清理 token、跳转登录页。
- 新增回归：`test_bearer_authentication_rejects_invalid_token_as_authentication_failed` 与 `http-auth-expired.spec.ts` 的 invalid token 标准外壳用例。
- 定向验证：`cd server; ..\.venv\Scripts\python.exe -m pytest tests/test_auth_api.py tests/test_authentication.py -q` 通过，`26 passed`；`cd web; yarn.cmd test src/tests/http-auth-expired.spec.ts --runInBand` 通过，`4 passed`。
- 全量验证：后端 `214 passed`；迁移检查 `No changes detected`；前端 `20 files / 117 tests passed`；前端构建退出码 `0`，仅保留既有 Vite chunk size warning。

## 2026-07-09 登录后立即退出修复

- 浏览器调试发现当前登录页链路最终可停留在 `/platform/tenants`，控制台无 error/warn；浏览器截图和 localStorage 页面脚本在内置浏览器连接中多次超时，未继续绕过。
- 根因：后端登录/刷新接口返回标准外壳 `{ code, msg, data }`，但 `web/src/api/auth.ts` 仍按旧裸对象返回，导致登录页把 `undefined` 写入 `yesgo.control.access_token`，随后列表请求带坏 token 被踢回登录。
- 修复：`loginControl`、`loginTenant`、`refreshControlToken`、`refreshTenantToken` 统一解包标准响应外壳，并兼容旧裸对象。
- 新增回归：`web/src/tests/auth-api.spec.ts` 覆盖 auth API 标准外壳解包；`auth.spec.ts` 覆盖登录页写入真实 token 而不是 `undefined`。
- 验证：前端定向 `18 passed`，前端全量 `21 files / 120 tests passed`，前端构建通过；后端全量 `214 passed`，迁移检查 `No changes detected`。

## 2026-07-09 员工列表字段与列表规范

- 按用户要求调整员工列表字段：`ID、所属部门、登录账号、联系人、昵称、手机号、授权角色、状态、最后登录时间、更新时间`。
- 后端员工列表 payload 增加 `department_name`、`updated_at`，并通过 `select_related("department")` 联表获取部门名称；员工列表默认按 `id` 倒序。
- 员工角色授权接口复用员工列表 payload 构造，避免新增字段在不同接口中不一致。
- 前端员工列表将授权角色改为 Ant Design Vue `a-tag` 预设色 filled 展示，删除旧表头 `邮箱`、`超级管理员`、`已有角色`。
- 员工列表软删除筛选文案从 `展示已删除数据` 改为 `已删记录`。
- `StandardListTable` 统一设置空状态 `暂无数据`，避免显示 Ant Design 默认 `No data`。
- 新增/更新规范：`AGENTS.md` 和 `docs/frontend/admin-list-standard.md` 明确列表默认过滤软删除记录，只有用户主动勾选/切换 `已删记录` 等明确入口时才展示；列表空状态统一为 `暂无数据`。
- 红灯验证：前端员工字段、软删除文案、空状态测试先失败；后端员工列表测试先因 `id` 正序失败。
- 定向验证：`cd server; ..\.venv\Scripts\python.exe -m pytest tests/test_control_rbac_api.py -q` 通过，`22 passed`。
- 定向验证：`cd web; yarn.cmd test src/tests/control-pages.spec.ts src/tests/control-staff-soft-delete.spec.ts src/tests/list-search-ui.spec.ts --runInBand` 通过，`3 passed / 44 tests passed`。
- 完成前验证：后端全量 `cd server; ..\.venv\Scripts\python.exe -m pytest -q` 通过，`214 passed in 28.47s`。
- 完成前验证：迁移检查 `cd server; $env:DJANGO_SECRET_KEY='test-secret'; ..\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run` 输出 `No changes detected`。
- 完成前验证：前端全量 `cd web; yarn.cmd test -- --runInBand` 通过，`21 files / 121 tests passed`。
- 完成前验证：前端构建 `cd web; yarn.cmd build` 通过，Vite 仍有既有 chunk size warning，退出码 `0`。

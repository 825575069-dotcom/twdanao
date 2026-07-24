# 进度记录：总控部门树与无顶级权限

## 2026-07-13 真实权限菜单与字体图标

- 后端 `ControlPermission` 增加 `icon_code`，权限树序列化、创建/更新接口和初始化迁移同步。
- `/api/control/me/menus/` 返回 `menu_keys` 与按 `sort DESC, id ASC` 的真实多级 `menus` 树；无角色用户返回空树，平台管理员可读取全部启用可见菜单。
- 总控布局消费后端菜单名称、路径、排序和图标；接口未提供 `menus` 时保留旧 `menu_keys` 过滤兼容路径，避免测试桩或旧客户端清空菜单。
- 新增 Ant Design Vue 图标白名单与权限详情页图标选择器。
- 定向后端：`43 passed`；迁移检查：`No changes detected`。
- 定向前端：`layouts.spec.ts` 与 `control-pages.spec.ts` 共 `63 passed`；构建成功（3365 modules transformed），仅有 chunk size warning。
- 全量后端最终验证：`271 passed in 42.02s`；初始化 SQL 与 Python 权限种子一致性回归通过。
- MySQL 已调整的总控权限排序已同步到权限种子与 `yesgo_init.sql`：一级菜单为 90 至 30，子菜单为 99 至 94；恢复系统“集成配置”权限。
- `yesgo_init.sql` 初始化权限数据补齐 `icon_code`，33 个菜单均有预设 Ant Design 图标；运行库已执行 `seed_control_permissions`，确认前五条高排序权限带有图标编码。
- 权限管理树改为 `sort DESC, id ASC` 排序；图标白名单扩充为 20 个常用后台图标。
- 本轮验证：后端 SQL/权限定向 `31 passed`、迁移检查 `No changes detected`；前端定向 `65 passed`，生产构建成功（仅 Vite chunk size warning）。
- 用户选择迁移基线重建：已移除所有历史增量迁移，按当前模型重新生成 `platform/0001_initial.py` 和依赖其的 `iam/0001_initial.py`；无模型的 tenantops、procurement_agent、observability 不再保留空迁移。
- `yesgo_init.sql` 的 `django_migrations` 已收敛为 contenttypes、platform/0001 与 iam/0001，适配重新部署时 SQL 直接建库。
- 验证：迁移检查 `No changes detected`；初始化 SQL/seed 定向 `18 passed`；后端全量 `270 passed in 36.25s`。

## 2026-07-11

- 已创建独立持久计划并设为当前活动计划。
- 已检查 Git 状态：工作区有大量未提交的 IAM、前端菜单及测试改动，均视为用户已有改动。
- 已初步定位部门页面、权限种子及现有权限树测试；尚未修改业务代码或测试。
- 已确认部门接口已返回树，前端当前把树拍平后以文本前缀模拟层级。
- 已确认 `control-root` 同时存在于权限种子、一级菜单计算、初始化 SQL 与权限树测试；登录校验本身未依赖该节点。
- 查询命令一次因 PowerShell 通配符语法失败，未影响文件或代码；后续改用精确文件路径。
- 用户已确认无角色账号登录后侧栏为空；登录成功不等同于拥有菜单权限。
- 用户已确认树形部门列表和彻底移除 `control-root` 的设计方向；正在编写设计说明，尚未触及业务代码。
- 已完成设计说明的占位符、范围和一致性自检。首次仅暂存设计文件时因 `.git/index.lock` 权限被拒绝，尚未创建提交。
- 受限授权后设计说明已进入暂存区；发现索引预存了无关改动，后续将使用路径限定提交，保护用户的暂存内容。
- 设计说明已通过路径限定暂存区检查，并以提交 `1cd5716` 单独提交；现等待用户审阅说明后再创建实施计划。
- 用户已认可设计说明；实施计划已写入 `docs/superpowers/plans/2026-07-11-control-department-tree-rootless-permissions.md`，等待选择执行方式。
- 已完成计划自检：覆盖前端树搜索、无根权限种子、数据迁移、初始化 SQL、无角色空菜单和全量验收；补充迁移测试中 `django_apps` 的明确导入。
- 用户选择子代理执行并授权隔离：已创建 `E:\www\YesGo\.worktrees\codex-control-department-tree-rootless-permissions`，分支为 `codex/control-department-tree-rootless-permissions`，初始提交为 `fc6d9f7`，工作区状态为空。
- 隔离工作区未含独立 `.venv` 和 `web/node_modules`；后续使用主工作区已存在的 Python 虚拟环境，并在隔离工作区安装前端依赖后运行基线测试。
- 前端依赖安装会话未返回最终完成行；在错误工作目录运行的 `yarn check --integrity` 失败，已记录并改用隔离工作区 `web/` 的实际测试命令。后端 pytest 已启动但输出未包含最终汇总，需单独重跑获取可审计基线结果。
- 隔离工作区前端全量基线：`yarn test -- --runInBand` 退出码 1，182 项中 179 通过、3 失败。失败位于 `web/src/tests/layouts.spec.ts:728` 与 `web/src/tests/profile-menu.spec.ts:201,219`，本任务的 `control-pages.spec.ts` 44 项通过；等待用户决定是否带着这些既有失败继续。
- 用户确认继续。子代理默认摘要脚本因无 `bash` 未执行；已在隔离 worktree 的 `.superpowers/sdd/task-1-brief.md` 写入等价的任务摘要，并创建执行台账。
- Task 1 已由子代理完成并提交 `80c21ff`，TDD 证据为 RED 预期失败、GREEN `control-pages.spec.ts` 45/45 通过。独立审查通过，无 Critical/Important 问题；Minor：测试夹具未包含无关分支，最终整体审查时复核是否需要补强。
- 在开始 Task 2 前发现隔离分支的迁移历史只有 `0004`，主工作区的用户改动含未提交 `0005_alter_controluser_contacter_and_more.py`。本任务设计中的根权限数据迁移应线性依赖 `0005`；若在隔离分支改为依赖 `0004`，合并到主工作区会形成并列 `0005` 分支，故暂停等待用户决定。
- 用户要求继续后，将 Task 1 提交 `80c21ff` 的前端改动同步到主工作区，保留主工作区既有计划文件改动。
- Task 2 已完成：权限种子移除 `control-root` 并将七个菜单分组改为一级；新增 `server/apps/iam/migrations/0006_remove_control_permission_root.py`，迁移会安全上移直属子权限、清理根权限角色绑定并删除根节点；初始化 SQL 同步改为无根结构。
- 新增后端覆盖：无角色总控账号菜单接口返回空数组；迁移函数重挂子节点并清理关联；权限树测试改为七个一级菜单。
- 定向验证：`pytest -q tests/test_control_permission_api.py tests/test_control_rbac_api.py tests/test_control_permission_migration.py`，`37 passed`。
- 迁移检查：`makemigrations --check --dry-run`，输出 `No changes detected`。
- 全量后端验证：`pytest -q`，`244 passed in 31.96s`。
- 前端全量验证：`yarn.cmd test -- --runInBand`，`27 passed / 1 failed`，共 `182 passed / 2 failed`；失败仍为既有 `profile-menu.spec.ts:201,219` 个人中心测试，与本任务无关。
- 前端构建：`yarn.cmd build` 被既有 `profile-menu.spec.ts` 重复导入 `ProfileAvatarEditor` 和 `AccountSettingsPage.vue` 的只读类型错误阻断，与本任务无关。
- 用户确认角色权限采用单个 Ant Design Vue 穿梭框，并且角色详情页只保留一个保存按钮。
- 新增计划：`docs/superpowers/plans/2026-07-11-role-permission-transfer-single-save.md`。
- `ControlRoleDetailView` 已改为单个 `a-transfer`；权限树扁平化为 Transfer records，编辑态统一保存角色信息和权限绑定，新增角色创建后继续绑定权限。
- 删除独立权限保存按钮及旧分组 checkbox/半选态逻辑；Transfer 在只读模式下禁用。
- 定向前端验证：`yarn.cmd test src/tests/control-pages.spec.ts --runInBand`，`40 passed`。
- 当前构建仍被既有 `profile-menu.spec.ts` 的重复 `ProfileAvatarEditor` 导入阻断；本次角色页面未新增构建错误。
- 用户确认将角色权限移出详情页，在角色列表操作列增加“权限”入口，通过弹窗配置；弹窗底部严格只有“取消”和“保存”。
- 新增设计说明：`docs/superpowers/specs/2026-07-13-role-permission-dialog-transfer-design.md`；实现计划：`docs/superpowers/plans/2026-07-13-role-permission-dialog-transfer.md`。
- 新增 `ControlRolePermissionDialog.vue`：单个 Ant Transfer 展示多级权限，父级选择会联动后代，底部仅取消/保存。
- 角色列表新增权限操作入口并编排权限查询/保存；角色详情移除权限配置区域，基础保存不再调用权限接口。
- 角色相关定向测试：`42 passed`；前端生产构建通过。
- 全量测试首次发现员工邮箱校验回归，已补充邮箱格式校验并恢复测试；定向员工与角色测试最终 `50 passed`。全量此前结果为 `29 passed / 1 failed`，修复后应重新跑全量确认。
- 继续处理前端遗留故障时，根因确认：个人中心已迁移到路由页，但 `profile-menu.spec.ts` 仍按已删除的布局内 Modal 断言；`AccountSettingsPage` 也将资料接口范围写死为 `control`。
- 修复后，布局测试验证个人中心跳转；设置页从 `route.meta.authScope` 推导控制/租户范围，租户个人中心会正确读取和保存租户资料。
- 修复重复 `ProfileAvatarEditor` 导入；定向验证 `profile-menu.spec.ts` 与 `settings-shell.spec.ts` 为 `11 passed`。
- 前端生产构建通过（3361 modules transformed）；仅有既有 Vite chunk size warning。
- 前端全量验证通过：`30 files / 188 tests passed`；仍有测试桩缺少 `a-radio-group`、`a-textarea`、`a-descriptions` 等 Vue warn，不影响退出码。
- 最终前端全量验证：`30 files / 197 tests passed`；保留既有测试桩组件未注册产生的 Vue warn，不影响退出码。
- 用户调整总控角色初始化数据：保留现有角色编码，名称与备注同步为超级管理员/总控超级管理员、管理员/总控管理员、数据经理/总控数据经理、运营经理/总控运营经理、数据专员/总控数据专员、业务专员/总控业务专员。
- 已同步 `seed_demo_data` 与 `sql/mysql/init/yesgo_init.sql`；seed 命令会更新已有角色的名称和备注，不只处理新建记录。
- 定向 seed/SQL 验证：`18 passed`；后端全量：`268 passed in 34.97s`；迁移检查：`No changes detected`。

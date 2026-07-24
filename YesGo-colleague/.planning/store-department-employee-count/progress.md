# 进度日志

## 2026-07-13

- 已创建本任务计划；会话恢复检查无待恢复上下文。
- 已开始定位门店列表、员工列表、路由和接口。
- 已确认总控部门列表和员工列表现状；用户确认“门店列表”即部门管理页。
- 用户要求采用动态统计；已完成设计说明与自审，等待用户审阅后进入实现计划。
- 用户已认可设计；正在形成细化实施计划。
- 已写入并自审实施计划；根据现有前端 mock 校正了路由筛选测试步骤，等待选择执行方式。
- 执行前隔离检查：当前目录是普通仓库（`git-dir` 与 `git-common-dir` 均为 `.git`），尚未获用户授权创建 worktree；待确认后再进入代码与测试阶段。
- 已获授权并创建 `E:\www\YesGo\.worktrees\department-staff-count`（分支 `codex/department-staff-count`）。
- 基线通过：`server/tests/test_control_rbac_api.py` 为 28 passed；`web/src/tests/control-pages.spec.ts` 为 44 passed。前端输出有既有 `a-descriptions` 解析警告，但无失败。
- 正在执行任务 1：先添加部门直属有效员工动态统计的失败后端测试。
- 任务 1 完成：新增 API 失败测试已验证缺少字段，最小实现后 6 项部门相关后端测试通过；提交 `a59820d feat: add dynamic department staff counts`。
- 开始任务 2：为部门列表统计列与跳转先写失败的前端组件测试。
- 任务 2 完成：统计列和点击跳转的失败测试转绿，前端页面规格为 44 passed；提交 `949babb feat: show department staff counts`。
- 任务 3 完成：路由部门筛选失败测试转绿，前端页面规格为 45 passed；提交 `c8e59f1 feat: filter staff by department route`。
- 开始任务 4：执行全量后端、迁移、前端测试与构建。
- 完整验证：后端 `271 passed in 56.54s`，迁移检查输出 `No changes detected`，前端 `201 passed (30 files)`，`yarn build` 退出码 0。
- 已删除并提交被误跟踪的临时数据库：`d9d2512 chore: remove tracked test database`。
- 最终 worktree `git status --short` 为空；本任务提交依次为 `a59820d`、`949babb`、`c8e59f1`、`d9d2512`。
- 用户选择本地合并；功能分支已合并到 `dev`。合并后复验：后端 `271 passed in 35.65s`，迁移检查 `No changes detected`，前端 `226 passed (31 files)`，`yarn build` 退出码 0。
- 已再次删除合并后测试生成的未跟踪 `server/db.sqlite3`；根工作区仅保留原有/计划跟踪文件改动。
- 用户反馈部门列表状态显示为数值；已开始系统化定位该展示回归。
- 已写失败测试确认缺少“启用”；新增具名单元格后根节点变为“启用”，发现测试 stub 不渲染子节点状态，正将转换逻辑提取为可直接断言的页面函数。
- 已新增 `formatDepartmentStatus`：`1 → 启用`、`0 → 停用`，并由状态列调用；定向 45 项与完整 226 项前端测试通过，生产构建成功；提交 `ca23bc5 fix: localize department status labels`。
- 用户反馈角色权限配置无法点击；已定位列表动作与弹窗状态入口，正在继续复现权限项交互。
- 已核对 `StandardListTable`：权限操作是可见的第二个原生按钮，点击事件会调用 `openPermissionDialog`；现有测试盲区在 Transfer 选择回调而非按钮声明。
- 尝试用 `yarn dev` 启动真实页面，因 Windows 环境未解析本地 Vite 二进制失败；将改用 `yarn.cmd`，避免重复该命令。
- 已用 Playwright 在 Vite 页面验证：点击“权限”会打开弹窗；已授权节点在左侧树仍显示勾选，点击后两侧 Transfer 箭头都禁用。右侧列表另行选中后才会启用移除箭头，确认问题是树勾选与 Transfer 临时选择语义冲突。
- 已新增失败回归测试：直接点击已授权树节点应移除授权；旧实现实测得到 `['101']` 而非 `[]`。已将弹窗改为直接管理授权集合的权限树，定向 `control-pages.spec.ts` 为 46 passed；Playwright 复验勾选状态会由已选切换为未选。
- 完整前端验证：`yarn.cmd test -- --runInBand` 为 227 passed（31 files）；`yarn.cmd build` 退出码 0。构建首次因新增测试桩的隐式 `any` 失败，已补齐类型后重跑成功；构建保留项目既有的超大 chunk 警告。

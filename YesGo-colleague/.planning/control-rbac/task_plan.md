# 总控与租户 RBAC 阶段计划

## 目标

优先完成总控后台 RBAC 功能闭环，在不破坏现有租户 RBAC 入口的前提下，为后续租户侧 RBAC 复用领域能力和界面模式。

## 当前阶段

- [x] 初步确认现有总控 RBAC 骨架
- [x] 建立持久计划文件
- [x] 与用户确认总控优先的第一阶段范围
- [x] 编写设计规格并确认
- [x] 编写实现计划
- [x] 测试先行实现总控 RBAC 缺口
- [x] 运行后端、前端和迁移验证
- [ ] 统一标准列表“更多”菜单并落实查看/编辑互斥规范
- [ ] 提升总控角色权限详情页可用性：分区展示、分区统计、半选态

## 阶段拆分

### 阶段 1：总控 RBAC 现状核对

确认模型、接口、页面、路由、测试覆盖和初始化数据之间是否一致。重点关注总控角色、权限、员工、部门、菜单绑定、当前用户菜单接口。

### 阶段 2：总控 RBAC 最小闭环

总控超级管理员能够维护部门、员工、角色、权限树，给角色绑定权限，给员工绑定角色；总控登录后能按角色返回可见菜单。

### 阶段 3：权限执行边界

在当前项目范围内先保证总控入口的认证和超级管理员保护不倒退；如要做到普通总控用户按 API 权限拦截，需要单独确认粒度和兼容策略。

### 阶段 4：租户 RBAC 准备

沉淀总控 RBAC 的领域服务、序列化和前端页面模式，后续扩展到租户后台角色、菜单、员工和智能体绑定。

## 验证要求

- 后端相关测试：`cd server; ..\.venv\Scripts\python.exe -m pytest -q`
- 迁移检查：`cd server; $env:DJANGO_SECRET_KEY='test-secret'; ..\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run`
- 前端测试：`cd web; yarn test -- --runInBand`
- 前端构建：`cd web; yarn build`
- Git 状态：`git status --short`

## 错误记录

| 时间 | 错误 | 处理 |
| --- | --- | --- |
| 2026-07-09 | 默认 `pwsh.exe` 启动失败，CreateProcessAsUserW failed: 5 | 改用 `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe` |
| 2026-07-09 | planning-with-files 的 `session-catchup.py` 在默认用户技能路径不存在 | 记录为环境差异，继续使用项目内计划文件 |
| 2026-07-09 | 记忆仓库 `MEMORY.md` 不存在 | 未使用记忆事实，改从仓库现状判断 |
| 2026-07-09 | PowerShell 禁止执行 `yarn.ps1` | 改用 `yarn.cmd` 执行前端测试 |
| 2026-07-09 | 首次 `yarn.cmd build` 因 `SiteContextResponse` 标准响应外壳类型和 Axios interceptor 测试非空收窄失败 | 补充 `SiteContextApiResponse` 联合类型、调用处解包收窄、测试 interceptor 非空断言后构建通过 |
| 2026-07-09 | 删除 `server/db.sqlite3` 的审批请求被自动审批服务拒绝 | 该文件为 Git 跟踪文件且当前未改动，保持不动并在汇报中说明 |

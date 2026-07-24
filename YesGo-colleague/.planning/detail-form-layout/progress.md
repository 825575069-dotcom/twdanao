# 进度记录

## 2026-07-10

- 已开始：盘点总控详情页表单结构，准备统一为左右栏 Ant 风格。
- 已确认：`ControlStaffDetailView`、`ControlDepartmentDetailView`、`ControlRoleDetailView`、`ControlPermissionDetailView`、`ControlTenantDetailView` 均适合统一到左右栏表单骨架，优先做结构收敛而不改业务逻辑。

## 2026-07-11

- 用户要求继续；恢复既有确认的左右栏详情页规范，不新增业务功能。
- 已重新盘点总控详情页：五个核心可编辑页面已经完成首轮适配，待评估资源详情和消息详情的页面类型，并确定共享样式的最小提炼范围。
- 结论：资源详情是动态字段的可编辑表单，应纳入左右栏规范；消息详情是只读内容展示，不纳入表单规范，避免改变其内容阅读体验。
- 当前阶段：共享表单样式提炼与资源详情适配，随后补前端回归测试。
- TDD Task 1：为资源详情补 `detail-form`、`detail-form-item`、`detail-form-actions` 断言，红灯为预期的类名缺失；完成最小模板改动后，定向测试 `44 passed`。
- 新建 `web/src/styles/detail-form.css`，在 `main.ts` 全局导入；移除部门、员工、角色、权限、租户详情页重复的通用 CSS，角色页仅保留权限分区的局部样式。
- 构建首次被缺失的 `vue3-slide-verify` 阻断。根因是该依赖已在 `package.json` 与 `yarn.lock` 中，但旧 `node_modules/.yarn-integrity` 未包含它；执行锁文件安装后恢复。安装过程中仅出现既有 `@vue/test-utils` peer dependency 提示。
- 前端定向验证：`yarn.cmd test src/tests/control-pages.spec.ts --runInBand`，`44 passed`。
- 前端全量验证：`yarn.cmd test -- --runInBand`，`23 files / 161 tests passed`；保留既有 `a-radio-group` 测试 stub 缺失的 Vue warn，退出码为 0。
- 前端构建：`yarn.cmd build` 成功，Vite 仅提示既有大 chunk warning。
- 后端全量验证：`pytest -q`，`238 passed in 30.62s`；迁移检查输出 `No changes detected`。
- 浏览器页面级检查：`http://127.0.0.1:5173/platform/ai-agents/1` 仍由旧开发服务提供，显示 `vue3-slide-verify` 缺失的 Vite 覆盖层。为避免中断用户已有服务，未停止或重启该进程；生产构建已在当前依赖完整的工作区通过。

## 2026-07-11 本地服务恢复

- 用户反馈 5173 页面无法打开。确认端口由 `wslrelay`（PID 8188）转发至旧 `/app` Vite 环境，该环境缺少 `vue3-slide-verify`；停止该过期转发后，直接用当前工作区 `node_modules/vite/bin/vite.js` 在 5173 启动开发服务。
- 浏览器验证：错误覆盖层已消失，`/platform/ai-agents/1` 自动落到总控登录页；点击“短信登录”后表单正确切换，证明前端可加载和交互。
- 发现 8000 仍由受保护的旧 `integrations` 进程占用，缺少 `/api/site/context/` 路由，站点上下文请求会 404，但不阻断登录页渲染。尝试在 8001 启动当前 Django 仅用于诊断，因本地 SQLite 未初始化导致 500，已关闭临时进程并清理空数据库；未修改仓库配置或初始化用户数据。
- 进一步确认 `localadmin.yesgo.86lw.cc` 的 80 端口由旧 `wslrelay`/Nginx 转发，仍会指向缺依赖的 `/app` Vite；当前 Windows Vite 可通过 `http://192.168.2.40:5173` 正常提供模块。停止该 80 端口转发以接管域名会影响其他本地域名，自动安全审查拒绝执行，等待用户明确授权。

## 2026-07-11 Docker 启动修复

- 用户提供 backend 启动日志，确认 `system_config` 已由初始化 SQL 创建，但 SQL 仍登记已废弃的 `platform.0006_sync_latest_dictionary`，导致 Django 尝试执行当前 `0006_systemconfig` 并报 MySQL 1050。
- 已将 `yesgo_init.sql` 中的基线迁移记录更新为 `0006_systemconfig`，并新增回归测试；同时将 web 容器启动逻辑从“仅检查 vite 二进制”改为 `yarn check --integrity`，确保新增依赖会触发容器内安装。
- 定向验证：`5 passed`；迁移检查输出 `No changes detected`。

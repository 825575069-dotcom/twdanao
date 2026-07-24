# 风险触发式登录验证码进度

## 2026-07-11
- 用户确认账号 + IP 计数、15 分钟窗口、失败三次后弹窗验证码。
- 安全设计规范已提交：`04f357b`。
- 正式实施计划已创建，尚未修改业务代码。
- Task 1 RED：`apps.iam.login_risk` 不存在；GREEN：风险上下文、可信代理解析、隔离键、阈值、清零与 cache 安全失败共 `5 passed`。
- 并发自审 RED：读取后写入可能丢失失败次数；改为 cache 原子 `incr` 与 `touch`，GREEN：`6 passed`。
- Task 1 迁移检查：`No changes detected`。
- Task 2 RED：`apps.iam.captcha_service` 不存在；服务端 challenge/token 初版 GREEN 与风险服务合计 `10 passed`。
- 轨迹加固 RED：单次大跨度跳跃被接受；加入单步位移和最终位置校验后 GREEN `11 passed`。
- 用户确认使用 `1007 = CAPTCHA_REQUIRED`，保留既有 `1002 = UNAUTHORIZED`。
- Task 3 RED：前三次失败后第 4 次仍直接登录成功；GREEN：控制端登录返回 `1007`，challenge/verify 后一次性 token 可完成登录，领域/API 测试 `12 passed`。
- 既有认证回归 `26 passed`，迁移检查 `No changes detected`。
- 前端认证 API RED：无法识别 `1007` 且缺少 challenge 调用；GREEN：`auth-api.spec.ts` `4 passed`，保留服务端业务码并仅发送服务端 captcha token。
- 前端已完成总控与租户登录页的 Modal 行为验证码接入；收到 `1007` 后打开弹窗，验证成功自动携带 token 重试，登录表单内容保持不变。
- 前端定向验证：`node .\\scripts\\run-vitest.mjs --runInBand src\\tests\\auth.spec.ts`，15 个测试通过。
- 环境记录：风险 worktree 中 `yarn` 不在 PATH，改用项目内 Vitest 启动脚本；依赖完整可运行。
- 验收：前端全量 `27 files / 177 tests passed`；`vue-tsc -b` 与 Vite 生产构建通过；Django `makemigrations --check --dry-run` 返回 `No changes detected`；风险验证码后端测试 `12 passed`。
- 后端全量 pytest 在终端输出回传时两次截断，未将其计为完整通过；此前同一代码版本已完成过 `250 passed` 回归，且本次改动后端文件未变化。
- 已清理 pytest 生成的 `server/db.sqlite3`。
- 缺陷修复：用户反馈登录页加载即出现验证码。RED：`auth.spec.ts` 证明 `LoginCaptchaModal` 在初始渲染时被挂载；GREEN：总控和租户登录页均改为 `v-if="captchaOpen"`，仅在服务端返回 `1007` 后创建组件，定向测试 `16 passed`。
- 验证记录：Vite 生产构建通过。前端全量测试被并行资料页改动阻断（`profile-menu.spec.ts` 两项失败），`vue-tsc` 同样因该测试的 `ProfileAvatarEditor` 重复导入失败；均不涉及本次登录验证码文件。

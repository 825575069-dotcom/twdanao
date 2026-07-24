# 进度日志

## 2026-07-14

- 已阅读系统化排障流程，先收集根因证据，不进行猜测式修复。
- 终端命令进程两次启动失败：`CreateProcessWithLogonW failed: 5`；已改用只读 Node 文件接口继续检索。
- 已确认前端连接创建点为 `web/src/features/realtime/client.ts:82`，默认 URL 构造位于 `web/src/features/realtime/session.ts`。
- 已确认根因：Django ASGI 仅支持 HTTP；Nginx 未配置 `/ws`，该路径会被送至 Vite。前端默认启动实时会话造成无效连接与重连。
- 已添加“未显式配置实时地址时不连接”的回归用例。首次执行使用了错误的仓库根测试路径，Vitest 提示 `No test files found`；将改用 `web/src` 相对路径重试。
- 使用 `src/tests/realtime-session.spec.ts` 重跑后，新增用例在旧实现上按预期失败：仍创建了 1 个 WebSocket。
- 已移除同源 `/ws` 默认值，改为仅接受非空 `VITE_WS_BASE_URL`；定向测试通过（5/5）。
- 首次全量测试在受限沙箱内把源文件错误映射到离线路径，34 个套件均未加载；在受限沙箱外重跑后通过（34 个文件、269 个测试）。
- `yarn build` 通过；仅存在项目既有的 500 kB chunk 大小提示。
- 已执行 `git diff --check`，无空白错误；已核对改动仅涉及实时会话与其回归测试，其他 Git 改动属于并行任务，未触碰。

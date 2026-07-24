# Task Plan: Chrome Plugin OpenAI Codex Access

## Goal
定位并尽量修复当前 Codex/Chrome 插件在本会话中访问 `C:\Users\xxxdh\AppData\Local\OpenAI\Codex` 时触发的 `EPERM` 问题，至少给出可验证的根因与可执行处理方案。

## Current Phase
Phase 2

## Phases

### Phase 1: 现象复现与证据采集
- [x] 复现 `EPERM` 错误
- [x] 确认触发点在 `import('playwright')` / 浏览器链路初始化
- [x] 记录宿主用户、沙箱用户与目录存在性证据
- **Status:** complete

### Phase 2: 根因定位
- [x] 对比 PowerShell 用户与 `node_repl` 用户身份
- [x] 验证 `OpenAI` 目录在桌面用户可读、在 `node_repl` 中不可读
- [ ] 确认是否能通过 ACL/属性调整让沙箱身份获得访问
- **Status:** in_progress

### Phase 3: 最小修复实验
- [ ] 设计单一变量的修复方案
- [ ] 执行最小权限修复
- [ ] 复测 `import('playwright')` 与最小打开页面链路
- **Status:** pending

### Phase 4: 验证与收敛
- [ ] 记录修复是否生效
- [ ] 若未修复，整理明确阻塞点与替代路径
- [ ] 更新 findings.md 与 progress.md
- **Status:** pending

### Phase 5: 交付
- [ ] 向用户汇报根因、证据、已执行操作
- [ ] 给出下一步建议
- **Status:** pending

## Key Questions
1. `node_repl` 的 `CodexSandboxOffline` 身份是否能被授予对 `C:\Users\xxxdh\AppData\Local\OpenAI` 的读取权限？
2. 即使授予读取权限，`playwright`/Chrome 插件是否还依赖其他仅桌面用户可见的路径或令牌？

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 先做根因定位，再做最小修复 | 避免在不清楚沙箱边界时盲改目录权限 |
| 将本次任务单独建计划目录 | 与业务开发计划隔离，便于后续恢复上下文 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `CreateProcessWithLogonW failed: 5` when using `exec_command` without escalation | 1 | 改用 `node_repl` 读取文件，必要时对 PowerShell 请求提权 |
| `EPERM: operation not permitted, lstat 'C:\\Users\\xxxdh\\AppData\\Local\\OpenAI\\Codex'` | 1 | 已定位到沙箱身份访问该目录失败，继续验证是否可通过 ACL 修复 |

## Notes
- 每完成一个实验就更新 `progress.md`
- 不做破坏性清理，优先最小权限修复

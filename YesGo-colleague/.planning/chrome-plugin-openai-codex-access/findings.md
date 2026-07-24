# Findings & Decisions

## Requirements
- 用户选择继续修复本机 `OpenAI\Codex` 访问链路，而不是改走其他替代方案。
- 目标不是业务代码改动，而是确认并尽量恢复当前会话中 Chrome 插件的可用性。

## Research Findings
- `node_repl` 的最小调用 `nodeRepl.write('ok')` 正常，说明 REPL 本身可用。
- 在 `node_repl` 中执行 `import('playwright')` 会立刻触发 `EPERM: operation not permitted, lstat 'C:\\Users\\xxxdh\\AppData\\Local\\OpenAI\\Codex'`。
- 在 `node_repl` 中：
- `C:\\Users\\xxxdh\\AppData\\Local` 可 `stat`/`readdir`
- `C:\\Users\\xxxdh\\AppData\\Local\\OpenAI` 可 `stat`，但 `readdir` 返回 `EPERM`
- `C:\\Users\\xxxdh\\AppData\\Local\\OpenAI\\Codex` 的 `stat`/`readdir` 都返回 `EPERM`
- PowerShell 提权后确认：
- `C:\\Users\\xxxdh\\AppData\\Local\\OpenAI` 与 `...\\Codex` 目录都真实存在
- 目录 ACL 包含 `NT AUTHORITY\\SYSTEM`、`BUILTIN\\Administrators`、`ghost丶\\ghost`
- `chrome-native-hosts-v2.json` 存在，且其中路径配置指向 `C:\\Users\\xxxdh\\.codex` 与 `C:\\Users\\xxxdh\\AppData\\Local\\OpenAI\\Codex\\runtimes\\...`
- `node_repl` 中 `os.userInfo().username` 为 `CodexSandboxOffline`，不是桌面登录用户 `ghost丶\\ghost`。

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 将问题归类为“沙箱身份访问本地运行时目录失败” | 证据显示目录存在且桌面用户可读，失败发生在 `CodexSandboxOffline` 身份 |
| 下一步先尝试只授予读取权限 | 这是最小风险修复，先验证是否足够让插件完成初始化 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| 普通 `exec_command` 在当前环境中经常因 `CreateProcessWithLogonW failed: 5` 失败 | 改用 `node_repl` 做只读采集，PowerShell 需要时请求提权 |
| `node_repl` 变量跨调用持久化，重复命名报 `Identifier has already been declared` | 换变量名继续，不影响根因判断 |

## Resources
- `C:\Users\xxxdh\AppData\Local\OpenAI\Codex\chrome-native-hosts-v2.json`
- `C:\Users\xxxdh\.codex\plugins\cache\openai-curated-remote\superpowers\6.1.1\skills\systematic-debugging\SKILL.md`
- `E:\www\YesGo\.codex\skills\planning-with-files\SKILL.md`

## Visual/Browser Findings
- 当前未使用浏览器截图；关键证据来自 `node_repl` 和 PowerShell 目录/ACL 检查。

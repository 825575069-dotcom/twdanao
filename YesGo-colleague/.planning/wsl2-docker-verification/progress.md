# 进度

- 已完成现有 Docker、Django 设置、前端脚本和文档的只读调查。
- 已获用户认可：使用独立验证 Compose、顺序执行入口与 WSL2 Docker 实际验收。
- Git worktree 创建连续被平台审批服务 503 拦截；用户已允许在当前工作区仅新增验证文件和文档。
- 已新增 `docker/backend.verify.Dockerfile`、`docker/web.verify.Dockerfile`、`docker/compose.verify.yml`、`docker/verify.sh` 和 WSL2 验证说明。验证镜像通过 COPY 取得源码，不会挂载宿主源码目录。
- Windows 宿主不具备 `docker` 与 `sh` 命令，验证必须在 WSL2 执行。尝试从 Windows 调用 `wsl.exe -- bash -lc "cd /mnt/e/www/YesGo && docker compose -f docker/compose.verify.yml config && sh docker/verify.sh"` 时，平台自动审批服务返回 503；命令未启动，因此尚无容器测试、前端测试或构建结果。
- 2026-07-16：按用户请求再次执行 `wsl.exe -- bash -lc 'cd /mnt/e/www/YesGo && sh docker/verify.sh'`。命令在 PowerShell 解析阶段失败，提示 `wsl.exe` 未识别。后续诊断确认没有 `wsl`/`wsl.exe` 命令、`C:\\Windows\\System32\\wsl.exe` 与 `\\\\wsl$` 也不存在；本会话无法进入用户的 WSL2，故脚本及其三项容器验证均未实际开始。
- 2026-07-16：用户更正为指定发行版入口 `C:\\WINDOWS\\system32\\wsl.exe --distribution-id {1796e323-2558-473c-80cf-ce5e5f54fd9c}`。使用该精确命令重试，并申请宿主执行授权后再次尝试；两次均在 PowerShell 的进程解析阶段失败，提示该绝对路径未识别。结论是 Codex 执行器与用户已运行的桌面 WSL2 会话隔离，非仓库脚本、Docker 或测试失败。
- 2026-07-17：用户提供实际 WSL2 容器验证输出。`verify-backend` 的 pytest 完成但为 `180 failed, 160 passed, 7 errors`；证据显示容器缺少仓库级路径并无法解析 `api.shared.urls`，且测试密钥不匹配。已补充验证镜像布局回归测试，并修复 `backend.verify.Dockerfile` 的导入路径和最小资源复制范围，以及 Compose 的测试密钥；待用户 WSL2 会话复跑验证。
- 2026-07-17：已通过 `ssh -F C:\\Users\\xxxdh\\.ssh\\config wsl` 在实际 WSL2 执行 `docker/verify.sh`。构建在加载上下文阶段失败：`failed to xattr /mnt/e/www/YesGo/server/.pytest_cache: permission denied`，pytest 未启动。已新增 `.dockerignore` 排除 pytest 缓存、Python 缓存、SQLite、前端生成物、Docker 持久化卷和本地环境文件，并添加对应布局回归测试；待 SSH 复跑。
- 2026-07-17：复跑已读取新 `.dockerignore`（179 B），但 `**/.pytest_cache` 未能避免 BuildKit 枚举 `server/.pytest_cache`。已改为精确排除 `server/.pytest_cache` 并更新回归测试，准备再次复跑。
- 2026-07-17：精确排除后 `.dockerignore` 已读取为 200 B，但 BuildKit 仍在加载上下文阶段报同一 xattr 错误；未删除用户缓存。为绕过 WSL `/mnt/e` 元数据限制，`verify.sh` 现在将排除生成物后的源码 tar 到 `/tmp/yesgo-verify.*`，以 `VERIFY_BUILD_CONTEXT` 驱动三项 Compose 构建，并在 trap 中清理暂存目录；已加入静态回归契约，待 SSH 复跑。
- 2026-07-17：在远端正确目录的全量验证中，后端 pytest 成功运行并得到 `348 passed, 2 failed`。两项均是镜像内仓库布局测试：根 `.dockerignore` 未被验证镜像复制、远端生产 backend Dockerfile 缺少源码 COPY 指令。已在验证 Dockerfile 增加 `.dockerignore` COPY 并更新静态契约，下一步同步本地生产 backend Dockerfile 与验证 Dockerfile 到远端并复跑。
- 2026-07-17：最终通过 SSH 在 `/home/web/local.yesgo.86lw.cc` 运行完整 `sh docker/verify.sh`，退出码为 0。后端 pytest 通过；前端 Vitest 为 `43 passed` 文件、`304 passed` 测试；前端 Vite 生产构建通过。构建仅输出既有的大 chunk 警告。

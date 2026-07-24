# 调研记录

- `docker/compose.yml` 是本地常驻开发栈，含 MySQL 持久化卷和外部网络，不适合作为测试隔离边界。
- `docker/backend.Dockerfile` 已安装 pytest 与 pytest-django；Django 未设置 `MYSQL_HOST` 时使用 SQLite。
- `docker/web.Dockerfile` 使用 Node 20 Alpine；`web/scripts/run-vitest.mjs` 会忽略 `--runInBand` 并调用 Vitest run。
- 后端 SQLite 默认会写到 `server/db.sqlite3`，验证容器必须以匿名 volume 覆盖 `/app/server` 的数据库路径或指定临时测试数据库。
- 前端 `node_modules` 与 `dist` 必须由匿名 volume 覆盖，避免写入宿主 `web/` 目录。

- 2026-07-16 再次尝试 `wsl.exe -- bash -lc 'cd /mnt/e/www/YesGo && sh docker/verify.sh'`，PowerShell 返回“`wsl.exe` is not recognized”。随后确认 `Get-Command wsl,wsl.exe` 无结果、`C:\\Windows\\System32\\wsl.exe` 和 `\\\\wsl$` 均不存在。这是 Codex 当前 Windows 宿主缺少 WSL2 入口，不是 `docker/verify.sh`、Compose 或应用测试失败；脚本没有启动。
- 用户提供已运行发行版的启动入口 `C:\\WINDOWS\\system32\\wsl.exe --distribution-id {1796e323-2558-473c-80cf-ce5e5f54fd9c}`。按该入口在受限和获准的宿主执行环境各尝试一次，仍由 PowerShell 在进程启动前报告该绝对路径未识别；这证明当前 Codex 命令执行器无法访问用户桌面上的 WSL2 会话。未重复第四次，且验证脚本没有启动。
- 2026-07-17 用户在实际 WSL2 Docker 会话运行 `docker/verify.sh`：后端 pytest 为 `180 failed, 160 passed, 7 errors`。失败共享根因是 `backend.verify.Dockerfile` 仅复制 `server`，而测试以仓库根目录 `/app` 解析 `sql`、`docker`、`web`、`mobile`；同时容器内 `api` 导入需要显式 `/app/server` 路径。Compose 注入的 `DJANGO_SECRET_KEY=test-secret` 也与测试设置期望的 `test-secret-key` 冲突。
- 2026-07-17 通过 SSH 别名 `wsl` 实际执行验证。镜像构建尚未进入 pytest：Docker 发送构建上下文时读取 `server/.pytest_cache` 的 xattr 被 WSL 挂载拒绝。根因是仓库没有 `.dockerignore`；应排除测试缓存和其他生成物，避免其进入验证镜像上下文。
- 首次 `.dockerignore` 使用 `**/.pytest_cache` 后复跑，Docker 仍枚举该 WSL 路径并报相同 xattr 错误，说明该构建器没有在元数据读取前应用通配规则。改为显式 `server/.pytest_cache` 路径；不删除用户缓存。
- 显式 `server/.pytest_cache` 后仍出现同一 xattr 错误，确认 Docker BuildKit 会在 `.dockerignore` 生效前读取 `/mnt/e` 的该目录元数据。验证脚本改为用 `tar` 将排除生成物的源码暂存到 WSL `/tmp`，Compose 通过 `VERIFY_BUILD_CONTEXT` 以暂存目录构建；脚本 trap 清理该临时目录。
- SSH 全量复跑后端 pytest 为 `348 passed, 2 failed`。根因均为镜像布局：验证 Dockerfile 未复制根 `.dockerignore`，远端生产 `docker/backend.Dockerfile` 没有任何 `COPY` 指令，违反已有仓库布局测试；本地版本含 `COPY server /app/server`，需同步到远端。

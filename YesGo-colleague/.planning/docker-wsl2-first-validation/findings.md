# 发现记录

## Requirements

- 在 WSL2 中按 Docker 验证仓库首次启动流程。
- 只报告实际步骤、结果和阻塞项；不修改业务代码。

## Research Findings

- `docker/compose.yml` 已定义 backend、web、worker、mysql、redis；依赖外部 Docker network `yesgo-networks`。
- `docker/.env.example` 与实际 `docker/.env` 仅包含 MySQL、Redis 与端口参数；业务配置应来自仓库根目录 `.env`。
- 工作区已有未跟踪的 WSL2 验证资产：`.planning/wsl2-docker-verification/`、`docker/compose.verify.yml`、`docker/verify.sh`、两份 verify Dockerfile 和 `docs/deployment/wsl2-docker-validation.md`。它们不是本次创建，必须先审阅而非覆盖。
- 当前执行环境中 `wsl.exe` 不可解析，因此无法从此会话实际进入 WSL2，也无法在目标 WSL2 Docker 引擎执行 Compose。
- 当前执行环境同样没有 `docker` CLI 与 `sh`，且 `C:\\Windows\\System32\\wsl.exe`、`\\wsl$` 均不可见；这确认阻塞来自本 Codex 运行环境，而不是仓库 Compose 内容。
- 现有隔离验证入口 `docker/verify.sh` 会依次运行后端 pytest、前端 Vitest 与前端构建，并以 `trap` 清理验证容器和匿名卷；其 compose 文件不挂载宿主源码或开发数据卷，符合首次容器验证需求。

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| 先预检再执行 Compose | 可区分 WSL、Docker 引擎、编排和应用启动四类问题。 |
| 不触碰已有未跟踪验证资产 | 保留用户或并行工作的改动，先读取其设计后再决定执行入口。 |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| 规划技能的 `session-catchup.py` 所在路径不存在 | 不重复执行，改为直接检查仓库和 Git 状态。 |
| `wsl.exe` 命令不可用 | 当前会话无法代替用户的 WSL2 运行环境；改为核验仓库验证脚本及文档。 |
| 当前环境缺少 Docker CLI 和 POSIX shell | 无法执行 Compose 配置解析或容器构建；应在 WSL2 发行版终端运行已有验证入口。 |

## Resources

- `docker/compose.yml`
- `docker/.env.example`
- `AGENTS.md`

# 进度

- 2026-07-17：用户在 WSL 现有 backend 容器执行 pytest，结果为 14 failed、355 passed。
- 2026-07-17：通过 SSH 确认 Compose 挂载与环境变量，完成失败分类；尚未修改业务代码或远程代码。
- 2026-07-17：确认账号重复失败来自 MySQL 对条件唯一约束的不支持；等待用户确认修复设计后再按测试先行修改本地代码。
- 2026-07-17：用户确认使用现有容器与真实服务；测试仅使用 `test_yesgo` 和隔离 Redis 逻辑库/键空间，禁止触及开发数据。
- 2026-07-17：用户进一步明确要求直连 `yesgo` 与现有 Redis；已写入受控集成验证设计和逐步实施计划，禁止完整 pytest 的建测试库行为。
- 2026-07-17：在用户明确授权后完成真实服务受控探针。MySQL：创建 `control_user.account=verify_live_codex_20260717a`，查询得到 ID 2；精确删除影响 1 行，复查计数为 0。Redis：键 `yesgo:verify:codex:20260717a` 依次返回 `OK`、`ok`、`1`、`0`（写入、读取、删除、确认不存在）。未执行迁移、清库、删表或全量 Redis 删除。
- 2026-07-17：按用户授权保留固定手工验证数据。MySQL 查询确认 `control_user` 中存在 `ID=3, account=verify_live_manual, nickname=Manual Verify`；Redis 查询确认 `yesgo:verify:manual=ready`。该直连 MySQL/Redis 手工验证流程通过。
- 2026-07-17：开始权限管理真实服务验证，覆盖租户角色权限、角色-智能体绑定 API、超级管理员允许、普通成员拒绝、工作台可见性与总控权限守卫。通过 stdin 注入的大型脚本未回传 stdout/stderr，不能判定断言结果；只读残留检查显示临时域名、租户账号、总控账号均为 0，未遗留测试数据。下一步改用运行后读取输出的 `/tmp` 临时脚本方式获取可审计结果。
- 2026-07-17：按用户要求重整 `docs/deployment/本地部署与验收.md`。更新为根 `.env`、当前五服务、真实 MySQL/Redis 数据边界、容器内手工自动化验证和实际 Nginx 文件；删除独立且重复的 `docs/deployment/wsl2-docker-validation.md`。`git diff --check` 通过，文档中已无已删除 Compose 与 Nginx 引用。

- 2026-07-17：恢复 
eal-compose-test-verification 计划；本地读取模型、迁移、初始 SQL 和路径测试，确认账号约束与 Compose 资源挂载两项根因，准备按现有失败测试先行实施。
- 2026-07-17：完成实施：新增 IAM `0004_active_identity_keys`，以软删除时清空的账号和微信 OpenID 键代替 MySQL 不支持的条件唯一约束；模型、初始化 SQL 与迁移记录已同步。backend Compose 增加只读仓库契约资源挂载。已移除两个引用仓库中不存在的 `backend.verify.Dockerfile` / `compose.verify.yml` 的过期布局断言，并改为断言当前 `docker/verify.sh` 的 Compose 路径。
- 2026-07-17：本地 `docker compose ... config --quiet` 未执行，因为 Windows 环境未安装 Docker CLI。首次使用 `Start-Process` 捕获完整 pytest 输出时误将标准输出与标准错误重定向到同一文件，PowerShell 拒绝启动；下一次将使用两个独立临时日志文件。
- 2026-07-17：本地验证完成：`server/tests/test_auth_models.py`、`test_mysql_init_sql.py`、`test_mysql_dictionary_metadata.py`、`test_repo_layout.py` 共 36 项通过；`manage.py makemigrations --check --dry-run` 输出 `No changes detected`；完整 `python -m pytest server/tests -q` 输出 `370 passed in 50.71s`。远端 WSL 容器尚待用户同步本地修改后执行同一 pytest 命令复验。
- 2026-07-20：用户在现有 backend 容器复验，仍报 `/app/web/src/layouts/pro/menu.ts` 不存在，且 `ensure_mysql_database` 测试读取到 MySQL 环境变量。根因是 backend 尚未重建以载入新增 volume，以及 `tests/settings.py` 不应继承 Compose 注入的运行时环境变量。
- 2026-07-20：将测试设置改为固定 `DJANGO_SECRET_KEY=test-secret-key`，并在导入主设置前清除 MySQL、Redis、DEBUG 与 ALLOWED_HOSTS 运行时变量。针对性回归 5 项通过；完整 `python -m pytest server/tests -q` 输出 `370 passed in 87.26s`，迁移检查输出 `No changes detected`。仍需在 WSL 使用已同步 Compose 文件重建 backend 容器后复验。

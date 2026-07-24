# 调研记录

- 远程 Compose 的 `backend` 仅挂载 `server -> /app/server` 与 `sql -> /app/sql`，容器工作目录是 `/app/server`；容器 `/app` 并不包含 `docker`、`web`、`mobile` 或根 `.dockerignore`。
- 多个仓库布局测试以 `/app` 为仓库根目录，因此在运行容器内必然报 `FileNotFoundError`。
- Compose 注入 `MYSQL_HOST=mysql` 和真实 `DJANGO_SECRET_KEY`；`tests/settings.py` 使用 `setdefault`，故不会覆盖这两个值，导致“未配置 MySQL 时跳过”和测试密钥断言失败。
- `ControlUser` 与 `TenantUser` 使用带条件的 `UniqueConstraint`。MySQL 不支持 partial unique index，两个账号重复测试因此未抛出 `IntegrityError`，属于真实的数据完整性缺口。
- 复查 `test_yesgo` 时数据库已不存在，符合 pytest 测试结束自动删除测试库的行为；未读取或修改开发库 `yesgo`。
- 用户确认复用当前 MySQL、Redis 和 backend 容器，但要求测试新增的数据在结束后删除，且不得修改开发数据。

- 2026-07-17 本地复查确认：账号唯一约束当前依赖 deleted_at IS NULL 条件；初始 SQL 将账号唯一索引写为 (account, deleted_at) / (tenant_id, account, deleted_at)，MySQL 对多个 NULL 不判冲突。应沿用已用于手机号的有效键模式，为账号和微信 OpenID 增加软删除时清空的有效唯一键。
- Compose backend 运行容器根目录为 /app，开发时仅挂载 /app/server 和 /app/sql；至少菜单、Dockerfile、移动端契约、根 .dockerignore 的跨仓库契约测试都需要以只读方式挂载到 /app。
- 2026-07-20：用户复验显示运行中的 backend 仍缺失 `/app/web/src`，说明已修改的 Compose volume 尚未通过容器重建生效。另一个失败证实 `tests/settings.py` 的 `setdefault` 未隔离 Compose 注入的 `MYSQL_HOST` 与 `DJANGO_SECRET_KEY`；测试设置必须显式移除 MySQL/Redis 环境变量并固定测试密钥。

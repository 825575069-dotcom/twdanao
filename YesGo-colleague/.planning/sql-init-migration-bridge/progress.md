# 进度

- 已确认用户选择：首装使用 SQL 建库，后续继续由 Django migration 演进。
- 已开始盘点初始化 SQL 与迁移链路。
- 已补齐 `tenant_user.is_super_admin` 和 `iam.0003_tenantuser_is_super_admin` 初始化迁移记录。
- 验证：`20 passed`；`makemigrations --check --dry-run` 输出 `No changes detected`。pytest 仅有工作目录 `.pytest_cache` 权限警告。
- 后端全量用例分两批完成：215 + 128，共 343 项通过；已清理 `server/db.sqlite3`。
- 前端 `yarn test -- --runInBand` 和 `yarn build` 未执行：当前环境找不到 `yarn` 命令。
- 修复 `control_user` 初始化 SQL 的重复 `is_super_admin` 列；静态 SQL 测试通过，迁移检查无变更。
- 修复 worker Docker 镜像缺失 `PyMySQL`；静态镜像依赖测试通过，迁移检查无变更。

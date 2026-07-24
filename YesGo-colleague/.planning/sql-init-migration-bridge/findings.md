# 发现

- 当前 `yesgo_init.sql` 同时创建业务表和 `django_migrations`，并写入 migration 历史。
- backend 当前启动命令执行 `ensure_mysql_database && migrate --noinput && runserver`。
- 部署报错 `Table 'agent' already exists` 表明部署库中的表结构与 `django_migrations` 记录不一致，或初始化 SQL 执行未完成/版本不匹配。
- `docker/volumes/mysql/.gitkeep` 会使 MySQL 8.4 首次初始化失败，已在提交 `7ab19ac` 删除。
- 当前迁移链新增 `iam.0003_tenantuser_is_super_admin`，原初始化 SQL 漏了该迁移记录，且 `tenant_user` 建表漏了相应字段；现已同步。
- backend 必须保留 `migrate --noinput`：首装数据库中的迁移历史会使其成为空操作，后续发布的新 migration 则会正常执行。
- `control_user` 的初始化 SQL 原有两个同名 `is_super_admin` 列，导致 MySQL 在第 126 行建表时失败；已删除误写的“租户超级管理员”列，并增加唯一性静态测试。
- `worker` 服务也使用 MySQL，但 `docker/worker.Dockerfile` 缺少 `PyMySQL`；Django 因而无法加载 `MySQLdb` 兼容模块。已补齐驱动。

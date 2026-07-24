# SQL 首装与迁移衔接计划

## 目标

让全新 MySQL 数据卷通过 `sql/mysql/init/yesgo_init.sql` 创建当前全部表和基础数据；后端随后继续执行 Django migration，使未来新增 migration 能正常升级。

## 阶段

- [x] 盘点当前模型、迁移和初始化 SQL 的表及迁移记录。
- [x] 重建或校正初始化 SQL，使其与当前迁移基线一致。
- [x] 保留后端自动 migration，并加入首装衔接验证。
- [x] 运行 SQL/Migration 与后端验证并记录部署步骤。

## 约束

- 首次部署没有历史业务数据，可重建初始化 SQL。
- 后续版本必须继续以 Django migration 升级，不移除 backend 的 `migrate --noinput`。
- 保留用户已有无关改动。

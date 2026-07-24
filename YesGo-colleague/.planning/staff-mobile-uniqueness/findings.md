# 调研记录：员工手机号唯一性

## 现状

- `ControlUser.mobile` 与 `TenantUser.mobile` 都允许为空。
- 模型声明了条件唯一约束：总控按 `mobile`，租户按 `(tenant, mobile)`，仅作用于未软删记录。
- 新增总控员工路径直接调用 `ControlUser.objects.create()`；不能只依赖 `full_clean()` 做唯一性保护。
- MySQL 不适合承载 Django 条件唯一约束作为最终数据库保证。

## 已确认规则

- 总控与租户手机号唯一域隔离。
- 租户间手机号隔离。
- 软删后允许手机号复用。

## 决策

- 采用 `active_mobile_key`：有效用户写入手机号，软删或空手机号写入 `NULL`。
- 总控对键唯一；租户对 `(tenant, key)` 唯一。
- 迁移遇到现存重复有效手机号时失败，不静默改写数据。

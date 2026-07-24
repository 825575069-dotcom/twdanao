# OSS 根目录与头像路径发现

- 当前 `normalize_oss_root_prefix()` 对空字符串和 `/` 抛出 `ValueError`，与用户将 `OSS_ROOT_PREFIX` 留空的配置直接冲突。
- 当前对象键是“作用域优先”：`<root>/control/.../avatars` 或 `<root>/tenants/.../branding`；已确认改为“业务优先”。
- 现有上传用途共五种：头像、正向 Logo、反白 Logo、Favicon、采购附件。
- 新规则不迁移历史 OSS 对象；已保存的历史 URL 保持不变，仅新上传对象采用新键。
- `OSS_ROOT_PREFIX` 为空时对象键不能以 `/` 开头；非空时仍需去掉首尾 `/` 并拒绝 `..` 和反斜杠。
- 用户进一步确认租户路径不应使用 `tenant_code`；已改为数据库主键 `tenant_id`，以避免租户编码变更导致存储目录分裂。

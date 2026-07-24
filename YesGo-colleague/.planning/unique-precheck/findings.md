# 调研结论

- 后端已实现 `GET /api/control/staff/check-account/` 与 `GET /api/control/permissions/check-code/`，均返回 `{ available: boolean }`。
- 员工详情页仍含邮箱类型、表单字段、回填和格式校验，属于用户确认的不保留合并残留。
- 权限详情页的 `icon_code` 与菜单图标属于现有合并改动，本次保留。
- 全量前端测试发现旧邮箱格式校验用例与“邮箱不保留”确认冲突，已改为断言表单不存在邮箱字段。

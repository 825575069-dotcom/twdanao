# 调研发现

- 已实现表格页分布在 `web/src/views/control/`、`web/src/views/tenant/`、`web/src/views/common/`。
- `StandardListTable.vue` 已提供 `.search-panel`、`.search-row` 与 `.search-actions`，是统一样式的首选复用点。
- 典型不符合顺序的页面：登录日志（文本、枚举、时间）、操作日志（租户、枚举、文本、时间）、采购任务（文本、枚举）。
- 使用租户切换的页面（例如租户反馈、租户成员）应保持租户控件在首位。

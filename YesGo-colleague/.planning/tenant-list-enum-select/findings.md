# 发现

- `TenantListView.vue` 第 20、21 行当前使用两个 `a-radio-group`。
- 枚举值由 `tenantStatusOptions`、`platformStatusOptions` 提供，且筛选函数已基于对应字符串值工作。
- 只需替换模板控件为 `a-select`，无需修改状态、选项或过滤函数。

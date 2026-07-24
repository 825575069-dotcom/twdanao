# 发现

- `GET /api/control/feedback/` 已支持 `tenant_id`、`status`、`category`，无需后端改动。
- `ControlTenantFeedbackView.vue` 目前无搜索区域，列表加载已通过 `fetchControlFeedback(filters)` 支持传参。
- 现有总控租户接口 `fetchPlatformTenants()` 可供选择弹窗复用。
- 项目尚无可复用租户选择弹窗；总控租户成员页使用的是普通下拉框。
## 2026-07-20 最终审查修正

- 反馈分类以既有模型、迁移和租户端创建页为唯一契约：`1=功能建议`、`2=体验建议`、`3=问题反馈`、`4=其他`。
- 总控筛选页原计划中的分类文字映射与该契约冲突；用户于 2026-07-20 确认以既有契约为准。
- `TenantPickerDialog` 的 `selectedTenantId` 现以 `aria-pressed` 输出，使用方可以识别当前选择项。

# 调研记录

- `AccountSettingsPage.vue` 已采用 `140px` 标签列和中文冒号，作为本次视觉基准。
- 现有编辑页多数仍使用纵向布局或 `span: 6` 标签列。
- `ControlSystemSettingsView.vue` 已使用 Ant Design Vue 的 `show-count`，但直接显示数据库长度，未处理中文字符折算。
- 数据库长度目前通过静态 `maxlength` 或系统设置接口的 `max_length` 提供。
- `StandardEditForm.vue` 统一提供标签列、冒号和横向布局；`StandardTextInput.vue` 统一文本计数与长度折算。
- 已接入个人中心、系统设置、部门、角色、权限、员工、资源、租户详情、租户站点、品牌与智能体配置页。

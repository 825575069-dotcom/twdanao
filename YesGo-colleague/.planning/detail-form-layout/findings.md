# 调研发现

1. 总控详情页目前已经有共同的 `detail-page` 页面壳，但各页表单排版仍偏“纵向堆叠”，字段标签和输入区域没有形成统一左右栏规范。
2. `ControlPermissionDetailView.vue`、`ControlRoleDetailView.vue`、`ControlStaffDetailView.vue` 已经具备可集中收敛的结构：返回按钮 + 表单 + 保存按钮。
3. 这次改造重点是统一视觉与结构，不应改变字段校验、保存逻辑、只读逻辑和接口请求。

## 2026-07-11 恢复调研

4. 已完成的五个核心可编辑详情页都在页面内重复定义 `detail-page`、`detail-form` 与 `detail-form-actions` 样式；下一步应优先判断是否提炼共享样式，避免在继续覆盖页面时复制规则。
5. 当前仍有 `ControlResourceDetailView.vue` 与 `ControlMessageDetailView.vue` 两个总控详情页；它们是否属于可编辑表单页，需先核对其实际结构再决定是否纳入本轮，避免把只读详情强行改造成表单。
6. 五个核心编辑页的基础布局 CSS 完全一致；角色详情仅额外定义权限分区样式。因此共享样式可放入全局入口，页面保留角色特有样式即可，风险低于新增组件抽象。
7. 资源详情页测试已先出现预期红灯（缺少 `detail-form`），最小结构适配后同一文件恢复 `44 passed`；该结构测试将同时保护后续样式重构不丢失关键类名。

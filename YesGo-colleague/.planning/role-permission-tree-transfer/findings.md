# 调研记录：部门角色权限树穿梭框

## 用户请求

- 部门角色的权限编辑弹窗使用 Ant Design 的树穿梭框。
- 弹窗中的权限选择区域应居中展示。

## 已发现现状

- 现有弹窗组件位于 `web/src/components/control/ControlRolePermissionDialog.vue`。
- 前端测试已在 `web/src/tests/control-pages.spec.ts` 中覆盖总控页面，具体断言和数据契约待继续读取。
- `permissionTree` 保持原始 `children` 层级；`transferData` 是用于 Transfer 的拍平数据源；保存值为数字 ID 数组。
- Ant Design Vue 4.2.6 的 Transfer 支持自定义列表渲染，可用其自定义列表区域承载 `a-tree`。

## 待确认

- 现有树数据是扁平 `Transfer` 数据源还是带 `children` 的权限树。
- 组件的 props 与保存 API 将决定树节点键和提交值。
- 用户确认：仅穿梭框本体需要在弹窗内左右留白相等，底部按钮不在本次居中范围内。

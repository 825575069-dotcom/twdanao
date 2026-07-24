# 调研结论

- 员工授权页面使用普通 `a-transfer`，保留 Ant Transfer 的默认批量选择能力。
- 角色权限弹窗自定义了左侧树，并显式设置 `show-select-all=false`；因此需要在自定义左侧区域提供等价的全选与反选操作。
- 现有 `handleTransferChange` 在父权限右移时自动加入子权限，批量选择应复用该链路而不直接改动 `targetKeys`。
- Ant Design Vue 的 Transfer 在自定义树槽位中通过 `selectedKeys` 计算右移按钮状态；此前仅调用槽位 `onItemSelect`，没有由父组件持有树的受控选择状态。将该状态绑定为 `selected-keys` 后，树和穿梭框共享同一选择来源。

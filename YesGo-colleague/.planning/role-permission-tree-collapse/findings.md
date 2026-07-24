# 调研记录

- 用户报告路径：`/platform/permission/roles` 的配置角色权限弹窗。
- 表现：点击父级菜单后，二级菜单无法收起。
- 初步怀疑：为保证右侧树始终展示完整层级，组件把 `expanded-keys` 固定为所有节点；受控展开状态会覆盖用户点击结果。
- 浏览器初次快照确认目标页加载正常，角色“运营经理”的“权限”按钮存在且唯一；打开弹窗的交互调用超时并重置了浏览器连接，尚未完成在线复现。
- 组件源码已确认根因：左右 `a-tree` 都使用 `:expanded-keys="getTreeExpandedKeys(filteredItems)"`，这是每次渲染都重新生成的全量受控值，未绑定 `@expand`，因此父级永远不能保持收起。
- 已新增左右树收起回归测试，定向测试按预期失败：`sourceExpandedKeys` 与 `targetExpandedKeys` 均不存在。
- 最小修复：左右树分别使用 `sourceExpandedKeys` 和 `targetExpandedKeys`；权限树或已绑定权限变更时初始化为全量展开；`@expand` 将用户点击后的键数组写回对应状态。
- 定向测试已通过：`control-pages.spec.ts` 69/69。
- 二次浏览器验证受运行时连接阻断：原页面标签不再可领取，打开新页面又在加载阶段超时并重置连接；未对角色权限执行保存操作。
- 本次截图确认额外底线来自 `.permission-tree-transfer :deep(.ant-tree)` 的内层 `border`；Ant Transfer 列表已有外层边框，移除内层边框与无效圆角即可保留滚动区且消除重复线。

## 错误记录

- 计划技能的默认会话恢复脚本路径不存在：`C:\Users\xxxdh\.codex\skills\planning-with-files\scripts\session-catchup.py`。
- 浏览器交互调用出现 10 秒超时并重置连接；下一步按浏览器流程读取连接排障说明后，改用代码与组件测试复现。
- 浏览器恢复后 `browser.user.openTabs()` 返回空数组；新建标签加载目标页再次超时，未重复尝试。

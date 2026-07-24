# 调研发现

- 总控后台已存在部门列表：`web/src/views/control/ControlDepartmentManagementView.vue`，树形数据来自 `GET /api/control/departments/`，当前列为 ID、部门名称、排序、状态。
- 员工列表：`web/src/views/control/ControlStaffManagementView.vue`，当前仅支持账号、昵称、手机号、已删记录筛选；尚未读取路由 query，也没有部门筛选控件。
- 后端部门树由 `apps.iam.services.build_control_department_tree` 构建，序列化字段当前不含员工数；`ControlUser.department` 的反向关系名为 `users`，可以在同一查询中聚合直属员工数。
- 用户已确认“门店列表”指总控“部门管理”页面。
- `build_control_department_tree` 当前采用 `values()` 组装树；可用 `Count("users", filter=Q(users__deleted_at__isnull=True))` 在该查询增加 `staff_count`，并由树序列化器显式输出。
- 员工列表 API 已默认在后端排除软删除记录；前端保留本地账号、昵称、手机号筛选。设计中的部门筛选可先在前端处理 route query，无需扩展 API 参数。
- 新回归待排查：部门列表状态列未将数值枚举转换为中文。
- 根因已确认：部门页没有状态列具名插槽或显示转换，数值 `status` 被表格直接渲染；员工页已有 `1 → 启用`、其他值 `→ 停用` 的参考模式。
- 测试 stub 仅渲染根节点完整单元格，子节点只展示名称；枚举函数需要直接断言 `0` 和 `1`，不能依赖子节点页面文本。
- 新回归待排查：角色管理列表的“权限”操作调用 `openPermissionDialog`，会打开标题为“配置角色权限”的弹窗并请求角色权限树；需进一步确认用户所称“无法点击”是在列表动作还是弹窗内的权限项。
- 已确认列表“权限”按钮属于前两个行内操作，使用原生 `<button>` 并绑定 `openPermissionDialog`；弹窗在请求开始前即设为打开，因此不存在被“更多”菜单收起或等待接口后才显示的路径。
- 现有角色权限测试没有触发该按钮，也把 Transfer 的 `onItemSelect` 桩实现为空函数，未覆盖用户点击树节点或移动权限的真实交互。
- 本地直接运行 `yarn dev` 报 `vite is not recognized`；后续改用仓库约定的 `yarn.cmd` 入口。这是 Windows 命令解析差异，不是应用构建错误。
- 根因已在真实 Ant Design Vue 页面复现：左侧树把 `targetKeys`（已授权项）作为“已勾选”状态；再次点击仅调用 Transfer 的临时 `onItemSelect`，不会修改授权集合。用户必须改到右侧默认列表选中项，再点击无文字箭头才能移除，因此树上表现为“无法点击”。应让树节点点击直接增删 `targetKeys`，保留父节点选择自动包含子权限的既有规则。

# 调研记录：总控部门树与无顶级权限

## 用户请求

- 总控“部门管理”列表改为树状展示。
- 不再保留 `control-root` 顶级权限；账号可登录后台，原“系统管理”“日志管理”等一级菜单上移。

## 已发现现状

- 部门 API 已经由 `ControlDepartmentTreeSerializer` 返回嵌套 `children`；前端页面当前又把树拍平，并用“— ”前缀模拟层级，因此需要改为向表格直接传入树。
- `server/apps/iam/services.py` 的权限种子以 `control-root` 为父节点，并以它筛选一级菜单。
- `server/tests/test_control_permission_api.py` 对 `control-root` 的权限树结构有明确断言。
- `sql/mysql/init/yesgo_init.sql` 静态插入了 `control-root` 及其子项，初始化 SQL 必须同步。
- 总控登录序列化器按账号、启用状态和未删除状态查询；当前检索结果中没有 `control-root` 作为登录前置条件。菜单则由 `/api/control/me/menus/` 另行返回允许项。
- 静态前端 `controlMenuTree` 本来就以“工作台、租户管理、AI管理、财务管理、组织管理、日志管理、系统管理”为一级节点；移除权限树根节点不会要求再扁平化一层菜单。
- 工作区存在用户未提交改动，覆盖 IAM、菜单、登录日志及相关前后端测试；必须仅叠加本需求，不能回滚或覆盖。
- 用户确认无角色账号也可登录，但菜单为空；启用、未删除和密码校验仍是登录前置条件。

## 待验证

- `get_control_menu_permission_codes` 在无根节点后应从 `parent_code` 缺失的菜单分组推导一级菜单，并返回其子菜单白名单。

## 技术决策

| 决策 | 理由 |
|---|---|
| 使用现有组件和 API 约定 | 保持当前 Vue 3、Ant Design Vue 与 Django RBAC 结构，避免无关重构。 |

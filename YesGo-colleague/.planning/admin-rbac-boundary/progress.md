# 进度

- 已完成设计确认，等待定位既有 RBAC 判定与路由/接口边界。
- 已完成第一轮定位：前端路由仅做登录令牌校验，后端权限管理端点使用过宽的 `IsPlatformAdmin`。
- 已完成实施计划：`docs/superpowers/plans/2026-07-15-admin-rbac-boundary.md`。租户端现有路由只有角色列表和智能体绑定，需在同一计划中补齐权限、角色、部门的超级管理员入口与 API。
- 执行计划复核发现租户模型没有 `is_super_admin`；用户已决定新增该字段，需同步迁移、初始化 SQL 与租户默认管理员创建逻辑。
- 已完成租户 `is_super_admin` 的红绿循环：初始测试因模型缺字段失败；新增 IAM 迁移 `0003`、MySQL 初始化字段及演示租户管理员标记后，定向测试通过，`makemigrations --check --dry-run` 输出 `No changes detected`。
- 已完成总控 API 第一项红绿循环：真实 Bearer 的普通控制端账号原本可读取权限、角色、部门 API（200）；新增 `IsControlSuperAdmin` 并应用到权限、角色、部门及员工角色配置端点后，定向测试 2 项通过。

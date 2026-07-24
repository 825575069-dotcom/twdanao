# 进度记录：部门角色权限树穿梭框

## 2026-07-13

- 已定位到 `web/src/components/control/ControlRolePermissionDialog.vue`。
- 初次广泛搜索包含 PowerShell 通配符参数错误，未修改代码；后续改用精确路径。
- 发现 `.planning/.active_plan` 已指向另一任务；本计划建立后切换为当前活动计划。
- 已确认组件数据契约与 Ant Design Vue 的自定义列表能力；用户认可“外层容器水平居中穿梭框、保持按钮原位置”的设计。
- 规格已提交为 `644a4fe`，用户审阅认可；实施计划写入 `docs/superpowers/plans/2026-07-13-role-permission-tree-transfer.md`。
- 实施计划已提交为 `1cad67c`；隔离工作区为 `E:\\www\\YesGo\\.worktrees\\codex-role-permission-tree-transfer`，分支为 `codex/role-permission-tree-transfer`。
- `web/` 内首次运行目标测试时误使用 `web/src/tests/...`，Vitest 报“找不到测试文件”；后续统一从 `web/` 使用 `src/tests/...`。
- RED：新增树数据与居中容器断言后，`treeData` 为 `undefined`，目标测试如预期失败。
- GREEN：树穿梭框实现提交为 `0932143`；目标测试 `src/tests/control-pages.spec.ts` 44/44 通过。
- 首次构建发现模板内联回调参数 TS7006；根因是自定义 Transfer 插槽中 `a-tree` 事件参数无法推断。将回调移入已类型化函数后，修复提交为 `f4d5767`。
- 最终验证：`yarn.cmd test -- --runInBand` 通过（30 文件、200 用例）；`yarn.cmd build` 通过。隔离工作区 `git status --short` 为空。
- 误在隔离仓库根目录执行一次 `yarn.cmd test`，因缺少 `package.json` 未执行；已从 `web/` 目录完成最终全量测试。

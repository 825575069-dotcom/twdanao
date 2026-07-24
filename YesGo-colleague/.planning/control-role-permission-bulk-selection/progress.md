# 进度记录

- 2026-07-14：用户确认批量选择设计；实现计划已写入 `docs/superpowers/plans/2026-07-14-control-role-permission-bulk-selection.md`。
- 2026-07-14：新增失败用例，确认缺少 `handleSelectAll`；已实现左侧树“全选 / 反选”工具条与处理函数，定向 `control-pages.spec.ts` 62/62 通过。
- 2026-07-14：全量前端测试 34 个文件、268 条用例通过；`yarn.cmd build` 通过，仅有既有 chunk size warning。
- 2026-07-14：源代码与测试已提交为 `f56f0fe feat: add bulk role permission selection`。
- 2026-07-14：内置浏览器在“配置角色权限”弹窗中坐标点击“平台概览”后，仍显示 `0 项已选权限` 且右移按钮禁用，已复现树选择没有同步到穿梭框的真实问题。
- 2026-07-14：改为受控的 `selected-keys`，树事件同步 `sourceSelectedKeys`，并保留 Ant Transfer 的 `onItemSelect` 链路；新增回归断言。定向 `control-pages.spec.ts` 62/62 通过，待全量与浏览器复验。

# 调研发现

- `ControlDepartmentDetailView.vue` 的排序使用裸 `a-input-number`，按钮文案为“创建部门/保存部门”，与参考详情页统一“保存”不一致。
- 部门保存后直接跳回列表，没有调用 `formRef.validate()`，也没有任何成功提示。
- 现有 `ControlRoleDetailView.vue` 同样没有保存成功提示，说明“所有表单保存成功提示”不是部门页孤立问题，而是缺少统一规范与守护。
- `web/src/components/form/README.md` 已规定控件宽度、长度和唯一性校验，但未规定保存按钮名称、保存成功反馈与跳转时序。
- 真实保存但缺少成功提示的入口至少包括：部门、权限、角色、租户详情、租户角色-智能体绑定。
- 员工详情和员工授权已使用 `publishAlert` 提示成功，是可复用参考实现。
- `ControlResourceDetailView.vue` 的 `handleSave()` 只是 `Promise.resolve()` 占位，不能显示“保存成功”，否则会误导用户。
- 部门页排序控件与权限页一样使用裸 `a-input-number`；当前表单规范只约束宽度，没有定义数字排序控件的步进、精度、键盘/按钮交互及统一封装。
- 现有 `alert-usage-guard.spec.ts` 只禁止裸 Ant Alert/message/notification，没有守护“真实保存后必须发布成功提示”。
- 根因判断：规范缺少保存按钮/反馈契约，页面各自实现保存逻辑，导致文案、校验、提示和跳转时序分散且不一致。
- `StandardEditForm.vue` 当前没有转发内部 Ant Form 的 `validate()`；部门、角色、权限虽然持有 `formRef`，但尚不能通过标准表单壳执行统一校验。
- 真实保存且缺少反馈的完整前端入口还包括 `ControlRoleManagementView.vue` 的角色权限保存和 `TenantAgentConfigView.vue` 的单智能体配置保存。
- 已有符合规范的入口包括租户品牌、租户站点配置、系统设置、账号设置、员工详情及员工授权；这些页面保留现有可见反馈。

## 最终实施与审查结论

- Task 1（`949a237`）：规格符合、质量审查通过；审查仅记录 Minor——`standard-number-input.spec.ts` 未单独断言 `maxWidth: 100%`。本轮组件测试和全量测试均通过，该项不构成功能阻塞。
- Task 2（`9d6ee12`）：规格与质量审查通过，无任务新增问题；部门页完成统一数字控件、校验、防重、成功提示后跳转。
- Task 3（`2460957`、`a83b7da`）：首次审查指出 4 个 Important 测试缺口；补充失败分支、反馈顺序、pending 防重和数字控件契约后复审通过，生产实现无需再次修改。
- Task 4（`914563a`）：规格与质量审查通过，无 concerns；租户角色绑定和智能体配置成功反馈、失败不提示与 loading 复位均有测试。
- Task 5（`ce48fe5`、`61f290d`、`2a1f361`）：两轮审查先后指出字符串/正则守护可绕过问题，最终升级为 Vue SFC + TypeScript AST 守护；规格与质量复审通过，无剩余 concerns。
- 最终入口盘点：未覆盖入口为“无”。守护明确覆盖 10 个统一 `publishAlert` 真实保存入口、4 个页面内局部反馈入口，以及资源占位页不得伪造成功提示的契约。
- 本轮 Vitest warning 均为测试环境未注册 Ant Design Vue 组件，包括 `a-radio-group`、`a-tree`、`a-transfer`、`a-tooltip`、`a-radio`、`a-textarea`、`a-descriptions`、`a-descriptions-item`，不影响 256 个用例通过。
- 本轮生产构建 warning：主包 `dist/assets/index-BOpuW2mD.js` 为 1,646.57 kB（gzip 512.79 kB），超过 Vite 500 kB chunk 提示阈值；构建仍退出码 0。

## 终审修复发现（2026-07-14）

- AST 守卫的 `hasFeedbackAfter` 只用源码位置判断“写调用之后”，没有约束 success 与该次 awaited write 的控制流关系，因此 catch、finally、`if (false)` 等不可保证执行路径会误通过。
- `satisfiesSaveFeedbackContract` 对同名 awaited write 使用 `some`，因此多个 occurrence 只需其中一次满足；终审要求改为每次写调用都必须有可靠后继反馈。
- 本轮将先用四类合成反例确认现有实现 RED，再用有限的语句块/祖先语句规则修复，不引入完整 TypeScript CFG。
- 固定 allowlist 的自动发现属于可选 Minor；需先评估 Vue 模板事件到 script handler、API 写调用识别和占位排除的误报风险，再决定是否安全纳入。
- allowlist 自动发现本轮保留为 Minor：模板存在 `@click`、`@finish`、`@save`、`@ok`、`html-type="submit"` 等多种入口，且 `handleSubmit` 同时用于采购任务创建（非“保存”反馈语义），`handleSecuritySave` 又是无真实写接口的“建设中”入口。仅靠模板事件/命名会误报，进一步做 import/API 数据流分析已超出本次有限 AST 修复范围。
- 最终复审补充根因：语句块直接反馈约束仍不足以证明跨结构共同后继安全；带 catch 的 try 会吞掉写失败，无 else 的单分支 if 又没有完整分支覆盖。因此有限分析在这两类结构上保守停止，只继续允许完整 if/else 与无 catch try/finally。

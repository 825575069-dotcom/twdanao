# 详情页左右栏表单规范改造计划

## 目标

- 将总控后台各详情页表单统一为符合 Ant 风格的左右栏布局。
- 统一标题、返回入口、字段标签宽度、输入区宽度、底部操作区等视觉规范。
- 在不破坏现有表单逻辑的前提下，提升详情页的一致性与可维护性。

## 范围

- `web/src/views/control/ControlDepartmentDetailView.vue`
- `web/src/views/control/ControlPermissionDetailView.vue`
- `web/src/views/control/ControlRoleDetailView.vue`
- `web/src/views/control/ControlStaffDetailView.vue`
- `web/src/views/control/ControlTenantDetailView.vue`

## 阶段

1. [x] 盘点详情页现状
   - 确认表单页共同结构与差异。
   - 提炼可复用的左右栏样式规范。
2. [x] 样式规范落地
   - 统一详情页容器、标题区、返回按钮、表单排版、底部按钮区。
   - 保持 Ant 表单组件使用规范，不引入非必要视觉噪声。
3. [x] 页面逐个适配
   - 按页面修改模板结构和样式。
   - 保证原有字段、交互、只读状态和保存逻辑不变。
4. [x] 测试与回归
   - 更新/补充前端测试断言。
   - 跑相关前端测试验证。
5. [x] 继续收敛
   - 提炼六个可编辑详情页共用的左右栏表单样式，禁止复制第五份以后继续漂移。
- 将 `ControlResourceDetailView.vue` 纳入同一规范；`ControlMessageDetailView.vue` 保持只读内容详情样式。

## 2026-07-11 验收结论

- 六个可编辑详情页已收敛到共享样式；消息详情保持只读内容页。
- 前端和后端验收均已完成；浏览器页面级验证受运行中的旧开发服务依赖状态阻断，详见 `progress.md`。

## 验证

- `cd web; yarn test -- src/tests/control-pages.spec.ts --runInBand`
- `git status --short`

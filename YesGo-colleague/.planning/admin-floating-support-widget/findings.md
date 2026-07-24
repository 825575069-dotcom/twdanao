# 调研发现

- 设计规格：`docs/superpowers/specs/2026-07-12-admin-floating-support-widget-design.md`。
- 共用后台壳：`web/src/layouts/pro/ProAdminLayout.vue`，总控与租户通过 `scope` 共用。
- 前端依赖包含 `ant-design-vue@^4.2.6` 与 `@ant-design/icons-vue`。
- 项目已有统一消息反馈入口：`web/src/features/feedback/service.ts` 的 `publishAlert`。
- 工作树存在与本任务无关的 `.planning` 修改，必须保留。
- 布局测试集中在 `web/src/tests/layouts.spec.ts`，并通过 Ant Design Vue stub 验证壳层行为。
- 独立组件测试可沿用 `@vue/test-utils`、Vitest 和 `data-testid` 模式。
- `SiteContextResponse` 当前没有客服字段；为保持 YAGNI，本次计划不扩展后端站点模型，客服信息以 `AdminFloatingSupport` 的可选 props 表达，缺失时展示禁用状态。
- 统一提示区域 z-index 为 1200；悬浮组件应低于提示与模态框。

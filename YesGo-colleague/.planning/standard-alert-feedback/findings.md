# 后台标准 Alert 调研结论

- 官方 Alert 支持 `success`、`info`、`warning`、`error` 四种 `type`。
- Alert 用于页面内非浮层静态反馈，项目决定同时用根级 Alert 区承载短暂操作反馈。
- 当前业务代码存在 17 处裸 `a-alert` 和 7 处 `message.*` 调用。
- `web/src/api/http.ts` 直接导入 Ant message，需要改为无框架反馈发布服务。
- `App.vue` 已位于 Pinia 和 Ant ConfigProvider 内，适合挂载 `GlobalAlertRegion`。

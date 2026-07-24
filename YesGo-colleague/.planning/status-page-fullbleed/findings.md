# 发现

- `web/src/layouts/pro/ProAdminLayout.vue` 的 `admin-page-container` 对状态页已移除外层白底，但仍保留 `20px` 内边距。
- `web/src/views/common/AdminStatusPage.vue` 的 `admin-status-card` 使用白色到浅蓝的渐变、边框、圆角和阴影，是白色底纹的主要来源。
- 正常页面必须继续保留现有内容卡片样式。
- 浏览器截图中的 500 实际来自 `web/src/components/feedback/PageLoadFailureState.vue`，而非路由级 `AdminStatusPage.vue`；该组件被 24 个业务页面复用，原本仍带白色渐变卡片。

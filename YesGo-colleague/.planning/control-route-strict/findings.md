# 发现记录

- `web/src/router/modules/control.ts` 仍以 `/platform` 为总控布局和子路由前缀。
- 菜单定义、根入口、鉴权状态页、总控登录跳转、布局消息跳转和多个总控页面内导航均保留 `/platform/...`。
- 测试当前也把 `/platform/...` 作为断言和模拟数据；迁移必须同步更新，并新增旧前缀不存在的回归断言。
- `api/platform` 为前端 API 客户端模块名，及 `/api/platform/...` 兼容判断不属于前端页面路由，保持不变。

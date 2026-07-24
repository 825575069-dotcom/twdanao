# 发现

- 路由 `control-tenant-member` 已正确指向 `ControlTenantMemberListView.vue`，构建产物也包含该页面。
- 本地浏览器访问该路由时，因本地 Django 服务未运行，`/api/site/context/` 经 Vite 代理返回 500；这说明当前无法用本地环境确认用户环境中的首个接口错误。
- 与既有通用成员列表相比，新页面的 `loadMembers` 未捕获接口异常；它在 `onMounted` 的 `Promise.all` 中执行，成员接口拒绝时会抛出未处理错误。
- 因此优先锁定“成员接口失败仍保留页面壳和空列表”的行为，避免请求失败造成空白页。

# 调研记录

- 个人中心头像使用 `ProfileAvatarEditor -> uploadAvatar -> POST /api/upload/assets/`，接口会依据当前路由为 `/tenant/` 或总控自动附带对应令牌和租户 ID
- 共享上传端点已支持控制端和租户端头像上传，服务端测试覆盖两种认证上下文；需先为前端请求和上传中的可见 loading 增加回归覆盖
- `StandardEditForm` 已设置 `:colon="true"`；系统设置页的 `a-form-item` 在测试桩与真实表单布局上仍需要确认属性透传
- 总控系统设置加载没有 loading 状态；`a-select` 尚未使用 `show-search`
- 当前所有 Vue `a-select` 分散在少量页面，适合逐处显式启用而不引入改变现有绑定语义的包装层
- 回归测试已确认总控设置页缺少 `a-spin` 加载容器，配置下拉也没有 `show-search`
- `/api/upload/assets/` 使用 HTTP 200 承载业务失败码，头像组件只依赖 axios 的异常分支，因此会把 `code != 0` 错误当作上传成功

## 错误记录

- 计划技能的默认会话恢复脚本路径不存在，未影响本次调查

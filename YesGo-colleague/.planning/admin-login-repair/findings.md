# 调研发现

## 需求

- 修复当前后台登录失败。

## 初始上下文

- 工作区原有活动计划为部门表单保存反馈，尚未执行实施；本任务使用独立计划，避免混入无关改动。
- 近期认证相关改动包含总控 RBAC、Bearer 菜单接口与账户设置 scope；需要以当前代码和可复现请求为准。
- 前端 `web/src/api/auth.ts` 已正确把 camelCase 的 `captchaToken` 转换为后端 `captcha_token`，不是首轮可疑点。
- `ControlLoginView.vue` 只从 Axios 错误响应读取 `detail`，而后端项目约定错误使用 `{ code, msg, data }`，这是需通过真实响应确认的高风险边界。
- 认证 API 13 项、验证码/风险控制 API 与服务 12 项均通过；后端在账号密码错误、验证码要求和缓存不可用时都以标准响应的 `msg` 返回错误。
- 登录页 `normalizeLoginError()` 未读取 `response.data.msg`，会把后端明确返回的“账号或密码错误”“captcha required”“security verification unavailable”全部显示为“登录失败，请稍后重试”。这已构成可复现的前后端错误契约断裂。
- 本机运行配置未设置 `REDIS_URL`，Django 使用本地缓存并可成功读取；不支持“本机缓存不可用导致所有登录失败”的假设。

## 修复与回归

- `ControlLoginView.vue` 与 `TenantLoginView.vue` 现在优先保留历史 `detail`，否则读取标准错误响应 `msg`。
- 新增总控与租户登录页标准错误响应回归断言；修复前两个断言均失败，修复后认证前端 21 项通过。

## 待确认

- 浏览器真实错误确认失败处为 MySQL schema；`active_mobile_key` 已存在于模型和 `iam.0002`，未存在于服务中的 `control_user` 表。
- 本地直接运行 Django 默认连接为未迁移 SQLite，不能代表浏览器连接的 MySQL；下一步必须检查 Docker backend 容器并在该运行环境执行迁移。

## MySQL 实际状态与恢复

- 用户授权连接的 `yesgo` 库中，`control_user` 与 `tenant_user` 均已有 `active_mobile_key`，但 `django_migrations` 仅登记 `iam.0001`；这是初始化 SQL 结构与 Django 迁移记录脱节。
- 两张表均未发现有效手机号重复，因此可安全回填并添加新的唯一索引。
- 直接重跑 `iam.0002` 会因列已存在失败；直接 `--fake` 会遗漏回填和索引切换。恢复必须先完成这两项数据库操作再登记迁移。
- `sql/mysql/init/yesgo_init.sql` 原先仍只含旧手机号唯一索引，且只登记 IAM `0001`，与当前模型和 `iam.0002` 不一致；已同步修复并添加自动化断言。

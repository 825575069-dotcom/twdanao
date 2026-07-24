# 风险触发式登录验证码调研

- `GB/T 22239-2019` 要求登录失败处理和限制非法登录次数，但不规定固定阈值。
- 现有 `ControlLoginSerializer`/`TenantLoginSerializer` 直接校验密码并写登录日志。
- 现有 `_get_client_ip` 无条件信任 `X-Forwarded-For`，需要按可信代理修正。
- Django settings 已配置 Redis 优先、LocMem 回退的 cache 后端。
- 当前 `SliderCaptcha` 生成客户端随机 token，不能作为服务端可信验证结果。
- 登录 API 当前只返回解包后的 data，前端需保留业务码 `1002`。
- 已确认验证码业务码改用 `1007`，避免与既有未授权业务码 `1002` 冲突。

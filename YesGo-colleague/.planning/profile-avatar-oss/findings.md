# 个人中心头像 OSS 接入发现

## 现有能力

- `server/apps/integrations/oss.py` 已通过 `oss2` 上传文件，并使用 `OSS_PUBLIC_BASE_URL` 返回公开 URL。
- `server/apps/common/upload_services.py` 已统一生成对象键、执行文件规则校验并返回标准资源元数据。
- `avatar` 当前允许 PNG、JPEG、WebP，最大 2 MiB。
- Web 已有 `ProfileAvatarEditor.vue` 和 `/api/upload/assets/` 调用。
- 后端已有 OSS 服务与头像上传桥接测试。

## 当前缺口

- `AccountSettingsPage.vue` 固定以 `control` 作用域读取和保存资料，租户个人中心无法正确复用。
- `avatar` 当前 `requires_tenant=False`，对象键始终生成到 `control/avatars/...`，无法体现租户隔离。
- 上传成功仅更新页面表单，仍依赖用户再次点击“保存”，可能产生 OSS 悬空对象。
- 前端 `accept="image/*"` 比后端允许类型更宽，错误反馈也未区分类型、大小与服务异常。

## 约束

- OSS 密钥只能在后端使用。
- 租户接口必须读取并校验 `X-Tenant-ID`、成员关系与作用域。
- API 保持 `{code,msg,data}` 标准响应。
- 不引入前端直传、STS、图片裁剪或历史对象自动清理等额外范围。
- OSS 连接参数与 `OSS_ROOT_PREFIX` 必须同时维护在根目录 `.env` 和 `.env.example`；真实业务配置不得放入 `docker/`。

## 目录规划

- 根目录：`<OSS_ROOT_PREFIX>/`，默认 `yesgo/`。
- 总控头像：`control/accounts/<account_id>/avatars/YYYY/MM/<uuid>.<ext>`。
- 租户头像：`tenants/<tenant_code>/accounts/<account_id>/avatars/YYYY/MM/<uuid>.<ext>`。
- 品牌资源：`tenants/<tenant_code>/branding/<resource>/YYYY/MM/<uuid>.<ext>`。
- 采购附件：`tenants/<tenant_code>/procurement/attachments/YYYY/MM/<uuid>.<ext>`。

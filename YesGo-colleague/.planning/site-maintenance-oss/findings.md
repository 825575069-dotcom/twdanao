# 发现记录

- 系统配置定义在 `server/apps/platform/system_config.py`：`site_status` 当前选项为“停服/关服”，`server_open_time` 仍是文本类型。
- `web/src/views/control/ControlSystemSettingsView.vue` 已按 `value_type` 选择控件；它缺少日期时间分支，`a-radio-group` 没有明确的交互布局约束，上传数字输入有 `width: 100%`，但文本控件实际宽度需与 `StandardTextInput` 对齐。
- 已有统一的 OSS 上传服务与 `OssUploadButton`，当前 `apps/common/upload_types.py` 的类型和大小规则是硬编码的，尚未读取总控 `upload_file_types`、`upload_image_types`、`upload_max_file_size_mb`。
- 上传链路已真实调用 `OssStorageAdapter`，由后端生成对象键并写入 OSS；前端无需也不应持有 OSS 凭证。
- 后端租户入口主要为 `/api/tenant/`、`/api/me/` 和租户态的 `/api/upload/`；当前只有 `TenantContextMiddleware`，尚无平台站点状态拦截。
- 前端租户路由与 Axios 拦截器可在收到专用关服业务码后跳转维修页；静态 SPA 页面本身仍需由前端路由守卫覆盖。
- 现有 `.planning/.active_plan` 指向已完成规划、尚未实施的 `load-failure-feedback`；本任务使用独立记录目录。

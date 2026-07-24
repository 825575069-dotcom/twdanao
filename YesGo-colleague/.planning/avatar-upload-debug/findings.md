# 排查发现

- `web/src/api/upload.ts` 将头像发往 `POST /api/upload/assets/`，该接口使用共享认证并支持控制台与租户账号。
- `server/apps/integrations/oss.py` 对 OSS 上传异常没有转换成标准业务响应；前端捕获 HTTP 异常后只显示泛化提示，因此真实失败原因被隐藏。
- 根目录 `.env` 中 OSS 必需配置项均存在（仅核对变量是否存在，未读取值）。
- 后端实际虚拟环境执行 `import oss2` 失败；`server/pyproject.toml` 也缺少 `oss2` 依赖声明。这会导致所有真实 OSS 上传在运行时抛出 `RuntimeError`。
- 新增的回归测试已按预期失败：未捕获的 `RuntimeError` 让 `/api/upload/assets/` 返回 500，而不是可处理的标准服务不可用响应。
- 当前 `.env` 的 OSS 配置已通过只读 `get_bucket_info()` 验证，输出 `OSS_READ_OK`；503 不来自当前凭据、端点或 Bucket 的连通性。
- 头像选择组件此前立即上传。现已改为仅发出 `{ file, url }` 本地预览事件；账户页面在“保存”时才上传，失败后不清除待上传文件和 blob 预览。
- 2026-07-20 本机未运行后端或前端服务。首次启动后端时，本地 SQLite 缺少表，访问健康接口报 `no such table: tenant_platform`；执行迁移后健康接口恢复为 HTTP 200。
- 资料保存 API 的 400 响应使用统一结构 `{ code: 1001, data: { mobile: ["手机号已存在"] } }`。此前页面只读取 `Error.message`，因此丢失字段错误；手机号输入框也没有 ref，无法定位。
- 用户要求将同一交互覆盖其他字段（例如业务编码重复）：需要通用解析所有 `code=1001` 字段错误，提示首个错误，并由各表单把字段错误交给其表单控件定位；仅为手机号添加特例不能覆盖该需求。

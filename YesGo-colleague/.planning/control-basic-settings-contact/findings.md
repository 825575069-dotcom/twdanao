# 调研结论

- 总控 `/api/site/context/` 目前使用静态默认值，需改为读取 `SystemConfig`。
- 站点 Store 已驱动浏览器标题、Favicon 和侧边栏 Logo；补齐总控上下文即可复用。
- `AdminFloatingSupport` 已接受电话和在线客服 URL，但尚未接入布局参数，且服务时间为硬编码。
- 现有 OSS 上传目的按 `UploadPurpose` 白名单校验；总控 Logo 与 Favicon 应作为无租户范围的品牌资源，路径为 `branding/control/{logo|favicon}/YYYY/MM/{uuid}.{ext}`。

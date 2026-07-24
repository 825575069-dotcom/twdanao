# 发现记录

- 上传配置元数据定义位于 `server/apps/platform/system_config.py`
- `upload_max_file_size_mb` 已为 `value_type="number"`，Vue 页面依据该值渲染 `a-input-number`
- 当前三个上传说明均含中文句号，大小字段标题为“单文件大小上限(MB)”
- 前端固定 API fixture 位于 `web/src/tests/control-pages.spec.ts`，必须与后端返回文案同步

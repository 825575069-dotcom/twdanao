# 发现记录

- `ControlSystemSettingsView` 在加载失败后将空 items 直接传给 `a-empty`，是截图问题的直接原因
- `AdminStatusPage` 和 `adminStatus.ts` 已提供 `server_error` 视觉与文案体系
- `web/src/api/http.ts` 已单独处理认证过期，不应吞掉其他请求错误
- `StandardListTable` 固定将空表展示为“暂无数据”，需增加首次失败态入口
- 终审发现辅助请求也需区分失败：采购任务详情、租户筛选项和操作日志详情存在静默失败或误导性空态；资源详情角色加载与定时任务执行日志缺少失败提示，均应在已出页后使用提示反馈

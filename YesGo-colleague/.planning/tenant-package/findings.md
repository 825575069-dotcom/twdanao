# 调研发现

- 平台模型位于 `server/apps/platform/models.py`，已有 `Agent`、`Tenant`，尚无套餐、租户套餐或算力配额模型。
- 总控菜单已有“租户套餐”入口：`/platform/tenant/package`，当前复用通用占位列表与详情页。
- 现有租户 API 仅提供总控的租户列表与详情读写，位于 `server/apps/platform/views.py`。
- 租户智能体配置已存在，租户侧接口为 `/api/tenant/agent-configs/`；智能体代码固定为五个。
- 本次勘查时 `git status --short` 无输出，工作区未见未提交改动。
- Dify Workflow 每次调用是独立运行，可从运行记录查询状态、输出、token 用量、步骤数和耗时；因此平台可将实际 token 用量归集到租户与智能体维度，而不需在 Dify 中复制租户工作流。
- Dify 的并发上限与套餐配额是两类约束：`too_many_requests` 代表并发上限，`rate_limit_error` 代表 Dify Cloud 套餐额度；平台自己的租户套餐应在发起调用前先做配额校验与并发控制。
- Dify 的 `POST /workflows/run` 阻塞响应中已包含 `data.total_tokens`、`total_steps`、状态与工作流运行 ID；异步或流式场景可保存 `workflow_run_id` 后调用 `GET /workflows/run/{workflow_run_id}`，该接口明确返回 `total_tokens`（总消耗 Token）。该字段应作为 YesGo 套餐最终结算来源。
- 当前“租户套餐”仅有总控菜单、路由和通用资源页配置，尚未接入专用前后端实现；可在不兼容历史数据的前提下建立完整套餐领域模型与专用页面。
- 当前采购任务 API 与 worker 均明确标记为已退役，接口统一返回“开发中”；本次套餐功能应实现可复用的预校验与 Dify 结算领域服务及测试，但不能伪造不存在的采购运行时调用。
- 总控平台路由集中在 `server/api/control/platform/urls.py`，并复用 `apps.platform` 内的序列化和 View；现有资源套餐页面是含假数据的通用占位页，需改为专用 Vue 页面与 API。
- 现有业务码没有必要为“额度不足”等场景新增代码，可复用 `CONFLICT (1005)` + HTTP 409，并给出明确 `msg`；字段校验继续使用 `INVALID_PARAMS (1001)`。

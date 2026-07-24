# 调研发现

## 现状摸排

### 已有基础设施（可复用）

1. **Dify 客户端**：`apps/integrations/dify_client.py` 的 `DifyClient.run_workflow(workflow_code, inputs)`，阻塞模式 30s 超时，返回 `data.outputs`
2. **外部供应商仓储**：`apps/integrations/external_supplier_repository.py` 的 `ExternalSupplierRepository`
   - `search_goods(channel_id, keyword, limit=30, min_effective_stock=1)`：按关键词检索
   - `search_goods_by_barcode(channel_id, barcode)`：按条码精确匹配
   - `search_goods_by_standard_sku(channel_id, standard_sku_code)`：按标准 SKU 精确匹配
   - 默认按 `supply_price ASC, effective_stock DESC, updated_at DESC` 排序
3. **Dify 配置**：`apps/integrations/config.py` 的 `get_dify_settings()`、`get_workflow_api_key(workflow_code)`
   - 5 个智能体独立 API Key（procurement 的 key 真实可用）
4. **Dify payload 构建**：`apps/procurement_agent/result_builder.py` 的 `build_dify_payload()`
   - 已支持 `procurement_context` 字段注入采购上下文
5. **采购上下文构建**：`apps/procurement_agent/context_builder.py` 的 `build_procurement_context()`
   - 将候选商品列表标准化为 `{query_summary, candidate_items, ranking_rules}` 结构
6. **多租户权限校验**：`apps/iam/services.py` 的 `user_can_access_agent(user, tenant, agent_code)`
7. **租户认证**：`apps/iam/authentication.py` 的 `TenantBearerAuthentication`
8. **业务码体系**：`apps/common/views.py` 的 `ApiBusinessCode`（0/1001-1008/1500）+ `StandardizedApiMixin`

### 已被清空的骨架

- `apps/procurement_agent/models.py`：仅一行注释 "Procurement agent runtime models are currently retired."
- `apps/procurement_agent/services.py`：仅一行注释 "Procurement task services are retired with the runtime models."
- `apps/procurement_agent/worker.py`：仅一行注释 "Procurement worker is retired with the runtime models."
- `apps/procurement_agent/serializers.py`：仅一行注释 "Procurement task serializers are retired with the runtime models."

### 503 占位接口

- 路由：`/api/tenant/agent/procurement/tasks/` 与 `/api/tenant/agent/procurement/tasks/<id>/`
- 视图：`apps/procurement_agent/views.py` 的 `ProcurementTaskListCreateView`、`ProcurementTaskDetailView`
- 行为：全部返回 `{code: 1006, msg: "开发中", data: {}}` HTTP 503
- 测试：`server/tests/test_procurement_task_api.py` 共 5 个测试，全部期望 503
- 用户决策：**替换为对话式 API + 更新测试**

## 前端 WebSocket 协议（必须复用）

### URL 与连接参数
- URL：由 `VITE_WS_BASE_URL` 注入
- Query 参数：`access_token`、`scope`（control/tenant）、`tenant_id`（scope=tenant 时必填）

### 消息格式
```typescript
type RealtimeEnvelope = {
  event: string;
  payload: Record<string, unknown>;
  meta: Record<string, unknown>;
};
```

### 已知事件
- `notice.created`
- `notice.read`
- `procurement.task.updated`（旧任务事件，需替换或保留）
- `dashboard.data.changed`
- `system.heartbeat`（心跳）

### 前端客户端实现
- 位置：`web/src/features/realtime/`
- 自动重连：1s/2s/5s/10s 退避
- 未知事件：`console.warn` 不中断
- 心跳事件：忽略

### 后端现状
- **完全未实现 WebSocket**
- `asgi.py` 仅调用 `get_asgi_application()`
- `settings.py` 未配置 `channels`、`daphne`、`CHANNEL_LAYERS`
- `pyproject.toml` 未声明 `channels`、`daphne` 依赖

## 数据库与缓存

- 默认 SQLite，通过 `MYSQL_HOST` 切换 MySQL
- Redis 可选：`REDIS_URL` + `django_redis` 才启用；否则 `LocMemCache` 兜底
- AGENTS.md 强约束：MySQL 8+ 主库、PostgreSQL 15+ + PGVector 仅用于 AI
- **本任务决策：不引入 Redis**，3 秒缓冲队列走进程内 `asyncio`

## AGENTS.md 关键约束

1. 不允许把全部业务逻辑外包给 Dify
2. 平台侧负责租户上下文、权限、任务状态、供应商和业务数据、结果归档、审计、可观测性
3. Dify 侧只维护五个平台级工作流，租户个性化通过参数注入
4. MySQL 表设计默认不依赖外键约束，ORM 关系保留但 `db_constraint=False`
5. 业务码定义统一维护在 `docs/backend/api-business-codes.md`，新增需同步更新文档、公共实现、对应测试
6. 业务 API 响应必须使用 `{code, msg, data}` 统一结构，成功 `code=0, msg="success"`
7. 纯消息型错误 `data={}`，字段级校验错误才允许放入 `data`
8. `api/tenant/procurement` 目录不能存在（test_repo_layout 强约束）
9. 采购任务状态固定集合：pending/processing/succeeded/failed/partial_succeeded
10. `workflow_code` 只能是五个平台级工作流之一
11. 完成前必须运行：`pytest -q`、`makemigrations --check --dry-run`、`git status --short`
12. 测试生成的 `server/db.sqlite3` 提交前必须删除

## 环境变量现状

`.env.example` 中：
- `DIFY_BASE_URL=https://dify.86lw.cc/v1`
- `DIFY_PROCUREMENT_API_KEY=app-k00vESAlXYrm0XR2dFJhVWVW`（真实 key）
- `DIFY_PROCUREMENT_WORKFLOW_CODE=procurement`
- `EXTERNAL_PROCUREMENT_DB_*` 系列变量**未在 .env.example 中列出**，但 `apps/integrations/config.py` 的 `get_external_procurement_db_settings()` 会读取

## 业务码扩展需求

现有业务码不足以表达采购流程错误语义，需新增：
- 缺参数拦截（不修改缓存、不推卡片）
- 状态机不允许（如状态 0 收到非"变更商品"指令）
- 草稿未确认（用户尝试在草稿态下单）
- SKU 超限（单品匹配 ≥ 30）
- 会话已结束/已取消
- 方案未生成（无法下单）
- 缓冲队列处理中

## 测试基础设施

- `conftest.py` 提供 `tenant_factory`、`user_factory`、`member_factory` fixtures
- `member_factory(agent_codes=["procurement"])` 创建有采购权限的租户用户
- 测试 settings：`tests/settings.py`（与生产 settings 分离）
- 现有测试都用 `@pytest.mark.django_db` + `APIClient`

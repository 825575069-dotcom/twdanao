# 基于 Dify 实现对话式采购智能体

## 目标

基于 Dify 实现一套对话式采购智能体：用户消息经 AI 意图识别，闲聊直接回复，采购需求进入标准化采购流程。完成商品/数量/收货地址录入后，系统展示价格最低、物流最快、综合推荐三类方案，支持实时编辑更新或重新发起采购重置缓存，下单后返回执行结果（成功清缓存、失败保留缓存可重新测算）。

## 用户已确认的关键架构决策

| 决策项 | 选择 | 说明 |
| --- | --- | --- |
| Dify 职责 | 仅做意图识别 + OCR + 闲聊回复 | 后端承担状态机/缓存/SKU检索/方案测算/下单/审计 |
| 存储介质 | MySQL 持久化 + 进程内 3 秒缓冲队列 | 不引入 Redis，单实例够用 |
| API 形态 | 复用现有 WebSocket 通道 | 后端需新增 channels 框架与 consumer |
| 接口替换 | 替换 `/api/tenant/procurement/tasks/` 为对话式 API | 更新现有 503 测试 |

## 阶段拆分

### 阶段 1：基础设施与业务码（执行中）
- [x] 创建 `.planning/dify-procurement-agent/` 三个跟踪文件
- [ ] 扩展 `ApiBusinessCode`，新增采购流程专用业务码
- [ ] 同步更新 `docs/backend/api-business-codes.md`
- [ ] `pyproject.toml` 加 `channels`、`daphne` 依赖
- [ ] `settings.py` 配置 `INSTALLED_APPS`、`ASGI_APPLICATION`、`CHANNEL_LAYERS`
- [ ] `asgi.py` 挂载 `ProtocolTypeRouter`

### 阶段 2：领域模型与迁移
- [ ] `procurement_agent/models.py`：ProcurementSession、ProcurementMessage、ProcurementCardSnapshot、ProcurementOrder
- [ ] `procurement_agent/states.py`：会话状态枚举（0/1/2/3）+ 订单状态枚举（pending/processing/succeeded/failed/partial_succeeded）
- [ ] `procurement_agent/intents.py`：9 类业务指令枚举
- [ ] 创建迁移文件 `0001_initial.py`
- [ ] `makemigrations --check --dry-run` 通过

### 阶段 3：核心业务服务
- [ ] `procurement_agent/services/` 拆分：
  - `session_service.py`：会话生命周期、状态机迁移
  - `intent_dispatcher.py`：9 类指令识别与调度，含优先级排他
  - `draft_cache.py`：临时草稿 + 正式缓存读写
  - `buffer_queue.py`：进程内 3 秒缓冲队列
  - `sku_threshold.py`：SKU 检索阈值规则
  - `plan_calculator.py`：三类方案测算
  - `order_service.py`：下单执行 + 缓存清理策略
- [ ] `procurement_agent/dify_service.py`：Dify 调用封装（意图识别+OCR+闲聊），扩展 `build_dify_payload`
- [ ] `procurement_agent/selectors.py`：会话/卡片/订单查询

### 阶段 4：API 入口
- [ ] `serializers.py`：SessionSerializer、MessageCreateSerializer、CardSerializer、OrderSerializer、PlanSerializer
- [ ] `views.py`：SessionListCreateView、SessionDetailView、MessageCreateView、CardDetailView、OrderCreateView、OrderDetailView
- [ ] `api/tenant/agent/procurement/urls.py`：替换 tasks 路由为 sessions/messages/cards/orders
- [ ] `consumers.py`：ProcurementSessionConsumer，推送 `procurement.session.card.updated` 事件

### 阶段 5：测试与验证
- [ ] 改造 `test_procurement_task_api.py` 为对话式测试
- [ ] 新增 `test_procurement_session_api.py`
- [ ] 新增 `test_procurement_state_machine.py`
- [ ] 新增 `test_procurement_intent_dispatcher.py`
- [ ] 新增 `test_procurement_dify_service.py`
- [ ] 新增 `test_procurement_consumer.py`
- [ ] `pytest -q` 全部通过
- [ ] `makemigrations --check --dry-run` 通过
- [ ] `git status --short` 检查临时文件清理

## 关键设计

### 状态机（双维度）

**会话状态（对话流程）**
- 0 = 无采购（空闲）
- 1 = 待确认商品与数量
- 2 = 待选地址
- 3 = 方案已生成

**订单状态（下单执行，遵循 AGENTS.md 约束）**
- pending / processing / succeeded / failed / partial_succeeded

### 9 类业务指令
1. 变更商品（新增/替换，文字/图片，状态 0/1/2/3 生效，状态 0 仅此指令豁免）
2. 变更数量
3. 重新采购（重置缓存）
4. 重新测算（基于现有缓存重算方案）
5. 取消采购
6. 选择方案（确认下单）
7. 确认商品（固化草稿）
8. 确认地址（固化草稿）
9. 查询当前方案

### 指令优先级（严格排他）
修改操作类 > 文字确认类 > 查询类 > 闲聊兜底类

### 缓存双轨
- 临时草稿缓存：用户修改操作先入草稿，未确认不生效
- 正式缓存：用户确认卡片后才固化

### 3 秒缓冲队列
- 进程内 `collections.deque` + `asyncio.sleep(3)` 实现
- 同一 session 3 秒内多条消息顺序执行，最终只推送一次卡片
- 单实例约束可接受（当前部署规模）

### SKU 检索阈值
- 单条消息多商品逐个检索
- 单品匹配 SKU ≥ 30 仅做超限标记
- 全部遍历完后统一提示超限商品
- 仅匹配正常的商品写入草稿

### Dify 调用契约

**输入（后端 → Dify）**
```json
{
  "inputs": {
    "tenant_id": 1,
    "role_code": "procurement_staff",
    "tenant_config": {},
    "session_state": 0,
    "confirmed_context": {...},
    "message": {
      "input_type": "text|image",
      "content": "原始文本或图片URL",
      "ocr_text": "图片OCR后文本（如有）"
    }
  }
}
```

**输出（Dify → 后端）**
```json
{
  "intent": {
    "code": "change_goods|change_quantity|restart|recalculate|cancel|select_plan|confirm_goods|confirm_address|query_plans|chitchat",
    "params": {...},
    "confidence": 0.92
  },
  "ocr_text": "图片识别文本（如有）",
  "reply": "闲聊或兜底回复文本"
}
```

### WebSocket 事件

**事件名**：`procurement.session.card.updated`

**Payload 结构**：
```json
{
  "session_id": 123,
  "card_type": "goods|address|plans|order_result|text",
  "card_data": {...},
  "session_state": 1,
  "version": 5
}
```

**Meta 结构**：
```json
{
  "tenant_id": 1,
  "user_id": 42,
  "emitted_at": "2026-07-20T10:00:00+08:00"
}
```

## 风险与约束

- **不引入 Redis**：3 秒缓冲队列单实例有效；多实例部署时需要重新评估
- **Dify workflow 实际可用性**：当前 `.env.example` 的 `DIFY_PROCUREMENT_API_KEY` 真实，但 workflow 内部是否已配置意图识别节点未知；后端实现需对 Dify 异常做兜底（失败时走闲聊兜底）
- **External Procurement DB**：`.env.example` 未列出连接配置，依赖 `ExternalSupplierRepository` 的部分测试可能跳过；方案测算需对外部 DB 不可用时做兜底
- **test_repo_layout 强约束**：`api/tenant/procurement` 不能存在，必须用 `api/tenant/agent/procurement`
- **不复制领域逻辑**：所有业务规则集中在 `apps/procurement_agent/services/`，入口层（api/tenant/agent/procurement）只做认证、权限、参数校验、序列化、路由编排

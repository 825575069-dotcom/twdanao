# YesGo AI 数字员工平台 — 总体架构设计 v1.1

> 版本：v1.1 | 2026-07-23  
> 变更：根据用户反馈，明确第一层仅预留 API 接口；第二层聚焦多商户 DB + 多 LLM + YesGo API；第三层多商户前端  
> 开发范围：第二层（天网大脑后端）+ 第三层（YesGo 多商户前端）

---

## 1. 三层职责边界

```
┌─────────────────────────────────────────────────────────────────┐
│ 第一层：商户平台（非本项目范围）                                  │
│   商城 · B2B/B2C/三方平台 · 客户ERP · 莱芬享 · 其他系统          │
│   → 通过预留 API 推送数据到第二层                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓ 商户数据接入 API（第二层预留）
┌─────────────────────────────────────────────────────────────────┐
│ 第二层：天网大脑 / 总后台中台总控（★ 本项目核心）                │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ 公共数据库    │  │ 商户数据库    │  │ 大模型网关            │  │
│  │ (共享)       │  │ (按商户隔离)  │  │ (多 API 接入)        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   YesGo 多商户 API 接口                    │   │
│  │  (REST API · Bearer Token · X-Tenant-ID 隔离)             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ YesGo 多商户 API
┌─────────────────────────────────────────────────────────────────┐
│ 第三层：YesGo 多商户前端（★ 本项目核心）                          │
│   Electron 桌面端 · H5 移动端 · Web SaaS                          │
│   统一 API 客户端 · 按租户切换 · 多智能体交互                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 第一层：商户平台（预留 API，本项目不实现）

> **明确：第一层不在本项目开发范围内。仅在第二层预留数据接入 API。**

### 2.1 预留的接入接口

```
POST  /api/v1/platform/products/sync       # 商户平台商品同步
POST  /api/v1/platform/inventory/sync      # 商户平台库存同步
POST  /api/v1/platform/orders/sync         # 商户平台订单同步
POST  /api/v1/platform/customers/sync      # 商户平台客户同步
POST  /api/v1/platform/distribution/sync   # 商户平台流向同步
```

每个接口通过 `X-Tenant-ID` 标识来源商户，`X-Platform-Key` 鉴权。

### 2.2 商户接入流程
1. 商户在 YesGo 开通后获得 `platform_key`
2. 商户系统调用上述 API 推送数据
3. 数据写入对应商户的隔离数据库
4. 商品可标记为「加入公共库」供其他商户参考

---

## 3. 第二层：天网大脑（本项目核心）

### 3.1 四大核心模块

| 模块 | 职责 | 技术实现 |
|------|------|---------|
| **公共数据库** | 平台级共享：标准商品库、采购目录、供应商池 | PostgreSQL `public` schema |
| **商户数据库** | 按企业信用代码隔离，每商户独立 schema | PostgreSQL 多 schema / 数据库路由 |
| **大模型网关** | 统一接入多个 LLM API，按任务/成本路由 | 插件化 Provider 模式 |
| **YesGo 多商户 API** | RESTful 接口，Bearer Token + X-Tenant-ID | Django REST Framework |

### 3.2 数据库设计

```
PostgreSQL
├── public schema（公共数据库）
│   ├── public_products        # 共享商品库
│   ├── public_suppliers       # 共享供应商
│   └── public_categories      # 共享分类
│
├── tenant_{credit_code}_1（商户 1）
│   ├── products               # 商户商品
│   ├── inventory              # 商户库存
│   ├── orders                 # 商户订单
│   ├── customers              # 商户客户
│   ├── distribution           # 商户流向
│   └── academic_materials     # 商户学术素材
│
├── tenant_{credit_code}_2（商户 2）
│   └── ... （同上结构）
│
└── platform（平台管理）
    ├── tenants                # 商户注册信息
    ├── tenant_users           # 商户员工账号
    ├── tenant_roles           # 角色权限
    ├── tenant_credits         # 积分账本
    ├── model_configs          # 大模型配置
    └── api_keys               # API 密钥
```

### 3.3 大模型网关

```
大模型网关（Model Gateway）
├── 商业 LLM
│   ├── OpenAI（GPT-4o / GPT-4o-mini）
│   ├── 文心一言（ERNIE）
│   ├── 通义千问（Qwen）
│   └── 其他商业模型...
│
├── 开源 LLM
│   ├── DeepSeek（API / 本地部署）
│   ├── Llama 3（本地部署）
│   └── Qwen 私有化（本地部署）
│
└── 路由规则
    ├── 意图识别 → 速度快、成本低的模型
    ├── 内容生成 → 质量高、上下文大的模型
    └── 敏感数据 → 本地部署模型（不出网）
```

### 3.4 YesGo 多商户 API 接口设计

```
# ===== 商户管理 =====
POST   /api/v1/tenant/register              # 商户注册
GET    /api/v1/tenant/info                  # 商户信息
PUT    /api/v1/tenant/info                  # 更新商户信息

# ===== 员工与权限 =====
GET    /api/v1/tenant/members               # 员工列表
POST   /api/v1/tenant/members               # 添加员工
PUT    /api/v1/tenant/members/{id}          # 更新员工
DELETE /api/v1/tenant/members/{id}          # 删除员工
POST   /api/v1/tenant/members/{id}/credits  # 调整积分

# ===== 智能体对话 =====
POST   /api/v1/chat/send                    # 发送消息（意图识别+派发）
GET    /api/v1/chat/history                 # 对话历史
GET    /api/v1/chat/conversations           # 会话列表

# ===== 数据底座 =====
GET    /api/v1/data/products                # 商品列表
GET    /api/v1/data/inventory               # 库存数据
GET    /api/v1/data/orders                  # 订单数据
GET    /api/v1/data/customers               # 客户数据
GET    /api/v1/data/distribution            # 流向数据

# ===== 经营看板 =====
GET    /api/v1/dashboard/overview           # 总览数据
GET    /api/v1/dashboard/kpi                # KPI 指标
GET    /api/v1/dashboard/alerts             # 预警信息

# ===== 模型网关 =====
GET    /api/v1/models/list                  # 可用模型列表
POST   /api/v1/models/test                  # 模型连接测试
PUT    /api/v1/models/config                # 模型参数配置

# ===== 系统配置 =====
GET    /api/v1/config                       # 获取配置
PUT    /api/v1/config                       # 更新配置
GET    /api/v1/config/dify                  # Dify 工作流配置

# ===== 商户数据接入（预留） =====
POST   /api/v1/platform/products/sync       # 商品同步
POST   /api/v1/platform/orders/sync         # 订单同步
POST   /api/v1/platform/inventory/sync      # 库存同步
POST   /api/v1/platform/customers/sync      # 客户同步
```

所有接口统一格式：
```json
{ "code": 0, "msg": "ok", "data": { ... } }
```

请求头：
```
Authorization: Bearer {token}
X-Tenant-ID: {tenant_id}
```

---

## 4. 第三层：YesGo 多商户前端（本项目核心）

### 4.1 技术选型

| 项 | 选型 |
|---|------|
| 桌面端 | Electron 33 + React 18 + TypeScript |
| H5/Web 端 | 同一套 React 组件，Vite 构建 |
| 图标 | lucide-react |
| 样式 | Tailwind CSS 3 |
| 状态管理 | React Context + useReducer |
| API 通信 | `src/lib/api.ts`（统一客户端） |

### 4.2 多商户支持

- 登录后通过 JWT token 携带商户身份
- `api.ts` 自动附加 `X-Tenant-ID` 请求头
- `appStore` 按当前登录商户加载数据
- 管理员可切换管理多个商户

### 4.3 组件映射（已建成，需接真实 API）

| 组件 | 接入的第二层 API |
|------|-----------------|
| ChatView | `POST /api/v1/chat/send` |
| AgentOfficeView | `GET /api/v1/chat/conversations` |
| DataView | `GET /api/v1/dashboard/*` |
| DataBaseView | `GET /api/v1/data/*` |
| ClientsView | `GET /api/v1/data/customers` |
| PermissionsView | `GET/POST/PUT/DELETE /api/v1/tenant/members` |
| CreditsView | `POST /api/v1/tenant/members/{id}/credits` |
| ModelsView | `GET /api/v1/models/list` |
| ConfigView | `GET/PUT /api/v1/config` |
| TasksView | 本地存储（后续接异步任务 API） |
| MediaView | 本地存储（后续接 OSS API） |

---

## 5. 数据流（端到端）

```
商户用户说话
    │
    ▼
[YesGO 前端] ── POST /api/v1/chat/send ──→ [天网大脑]
    │                                           │
    │                                    ┌───────┴───────┐
    │                                    │ 意图识别       │
    │                                    │ (模型网关路由)  │
    │                                    └───────┬───────┘
    │                                            │
    │                                    ┌───────┴───────┐
    │                                    │ 派发智能体     │
    │                                    │ (读商户数据)   │
    │                                    └───────┬───────┘
    │                                            │
    │                                    ┌───────┴───────┐
    │                                    │ 生成方案       │
    │                                    │ (调用 LLM)    │
    │                                    └───────┬───────┘
    │                                            │
    ▼                                            ▼
[展示结果]  ←── { code:0, data: { reply, agent, result } } ──
```

---

## 6. 项目结构（完整版）

```
YesGo/
├── yesgo-backend/                  # 第二层：天网大脑（Django）
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/
│   │   ├── settings.py             # 多租户配置
│   │   ├── urls.py                 # API 路由
│   │   └── wsgi.py
│   ├── apps/
│   │   ├── platform/               # 平台管理（商户/员工/角色/积分）
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   └── urls.py
│   │   ├── public_db/              # 公共数据库 API
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   └── urls.py
│   │   ├── tenant_db/              # 商户数据库（多 schema 路由）
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   ├── urls.py
│   │   │   └── router.py           # 数据库路由
│   │   ├── chat/                   # 智能体对话
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   ├── urls.py
│   │   │   └── dispatch.py         # 意图识别 + 派发
│   │   ├── model_gateway/          # 大模型网关
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   ├── urls.py
│   │   │   └── providers/          # 模型 Provider 插件
│   │   │       ├── openai.py
│   │   │       ├── qwen.py
│   │   │       └── deepseek.py
│   │   ├── dashboard/              # 经营看板
│   │   │   ├── views.py
│   │   │   └── urls.py
│   │   └── platform_gateway/       # 商户数据接入（第一层预留）
│   │       ├── views.py
│   │       └── urls.py
│   └── middleware/
│       └── tenant.py               # 多商户中间件
│
└── yesgo-frontend/                 # 第三层：YesGo 前端
    └── ai-employee-app/            # 现有前端项目
        ├── src/
        │   ├── components/         # 30+ 组件（已建成）
        │   ├── lib/
        │   │   ├── api.ts          # 统一 API 客户端 ← 接真实后端
        │   │   ├── dispatch.ts     # 本地意图识别回退
        │   │   └── dify.ts         # Dify 对接
        │   ├── store/
        │   │   └── appStore.tsx     # 全局状态 ← 接真实 API
        │   └── data/
        │       ├── mockAgents.ts   # 智能体定义（保留）
        │       └── mockSaaS.ts     # ⚠️ 逐步废弃，改接真实 API
        ├── electron/               # Electron 主进程
        ├── h5.html                 # H5 入口
        └── vite.config.h5.ts       # H5 构建配置
```

---

## 7. 开发优先级（重新排序）

| 优先级 | 内容 | 说明 |
|--------|------|------|
| **P0** | 天网大脑后端骨架 | Django 项目 + 数据库设计 + `api.ts` 对接 |
| **P1** | 多商户数据库 | PostgreSQL 多 schema + 数据库路由 + 中间件 |
| **P2** | 大模型网关 | 多个 Provider 实现 + 路由规则 |
| **P3** | YesGo 前端接真实 API | 替换 `mockSaaS.ts` → 真实 API 调用 |
| **P4** | Dify 工作流对接 | 5 大智能体工作流 API 接入 |
| **P5** | 商户数据接入 API（预留） | 第一层对接接口，供商户平台推送数据 |

---

## 8. 设计原则（重申）

1. **中台集中**：所有 AI、数据、配置能力在第二层统一管理。
2. **终端轻量**：YesGO 前端不存储业务数据，仅通过 API 与中台交互。
3. **商户隔离**：数据库按 `tenant_{credit_code}` 严格隔离。
4. **模型可替换**：统一网关抽象，切换模型只改 Provider。
5. **API 优先**：第三层所有功能通过第二层的 YesGo 多商户 API 实现。

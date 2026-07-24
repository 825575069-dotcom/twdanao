# YesGo AI 数字员工平台 — 需求与架构文档

> 版本：0.2.1（端到端逻辑跑通 + Bug 修复 + 功能完善） | 最后更新：2026-07-21  
> 对标产品：Marvis（Tencent 多智能体可视化协作平台）  
> 行业定位：垂直医药 B2B SaaS  
> 架构形态：Electron 桌面客户端 + Django 多租户后端 + Dify 智能体引擎

---

## 1. 产品概述

YesGo 是一款面向医药行业的 AI 数字员工桌面应用（Electron 桌面客户端）。底层对接多租户医药 SaaS 数据底座（商品/库存/订单/流向/客户），上层由**统筹中控 A Agent** 统一调度 5 个垂直业务智能体，通过自然语言对话驱动业务闭环。

核心设计理念：**一句话派发任务，智能体自动干完活回来汇报**。用户不用学会操作复杂的 SaaS 后台，像跟真人助理说话一样，下达指令即可。

### 1.1 用户体验对标

| 维度 | Marvis（腾讯） | YesGo |
|------|---------------|-------|
| 标志物 | 🐂 牛 | 🐰 白兔 |
| 形态 | 桌面 App | 桌面 App（Electron） |
| 核心 | 多智能体工位可视化协作 | 中控 A + 5 业务智能体工位 |
| 入口 | 自然语言对话 | 对话工作台 / 办公室输入条 |
| 行业 | 通用 | 垂直医药 B2B |

---

## 2. 技术栈

| 层 | 技术选型 |
|---|---------|
| 桌面壳 | Electron 33 |
| 构建工具 | Vite 5 + tsc |
| UI 框架 | React 18 + TypeScript |
| 样式 | Tailwind CSS 3（darkMode: class）+ 自定义 CSS 变量主题 |
| 图标 | lucide-react |
| 打包 | electron-builder（mac: dmg/zip，win: nsis） |
| 状态管理 | React Context + useReducer（appStore） |
| 路由 | 单页组件切换（ViewKey 枚举） |

### 2.1 后端平台（同事架构规范，v0.2.0 已融入）

| 层 | 技术选型 |
|---|---------|
| 后端框架 | Django + Django REST Framework |
| 数据库 | PostgreSQL（多租户隔离） |
| 智能体引擎 | Dify（5 个平台级工作流，独立 API Key） |
| 消息队列 | Kafka |
| 对象存储 | 阿里云 OSS |
| 容器化 | Docker Compose |
| 管理后台 | Vue 3 + Ant Design Vue + Vite（stepin-template） |
| 移动端 | uniapp |

### 2.2 架构升级（v0.2.0 → v0.2.1）

从 v0.1.0 mock 原型升级为对齐后端规范的生产级架构：

- **多租户**：`X-Tenant-ID` 隔离 + 租户套餐（按智能体月度 Token 配额）
- **Dify 集成**：`src/lib/dify.ts`（5 工作流独立 API Key + 租户参数注入）
- **统一 API**：`src/lib/api.ts`（`{ code, msg, data }` 标准响应 + Bearer Token + 自动刷新）
- **AgentCode 对齐**：五大智能体码 `procurement/operations/marketing/distribution/academic`
- **双层调度**：Dify 意图识别（第 1 层）→ 本地规则引擎（第 2 层回退）
- **角色-智能体绑定**：`AgentBinding`（按角色控制工作台可见性）

v0.2.1 完善内容：

- **端到端逻辑跑通**：全链路验证通过（输入→派发→执行→回报→对话）
- **Bug 修复**：ConfigView 恢复出厂配置覆盖问题；SettingsView 版本号更新
- **数据一致性**：添加「垂直行业 Pro」模型到 MODELS；补充 `setTenantPackage` 到 StoreCtx
- **跨视图任务通道**：后台常驻 AgentOfficeView 确保对话视图发起的任务始终可执行
- **采购闭环完善**：采纳按钮增加积分消耗 + 已采纳状态追踪
- **SettingsView 导航**：死按钮接通到对应视图（模型网关 / 客户B2B / 配置中心）

---

## 3. 项目结构

```
ai-employee-app/
├── electron/                    # Electron 主进程
│   ├── main.cjs                 # 主进程入口（窗口创建）
│   └── preload.cjs              # 预加载脚本（安全上下文桥接）
├── public/                      # 静态资源
│   └── icon.png                 # 应用图标（待替换为白兔）
├── src/
│   ├── main.tsx                 # React 入口
│   ├── App.tsx                  # 根组件（ThemeProvider + StoreProvider + 路由 + 对话派发）
│   ├── index.css                # 全局样式 + CSS 变量主题系统
│   ├── types.ts                 # 类型定义（Agent, ExecLog, LogLevel）
│   ├── vite-env.d.ts            # Vite 类型声明
│   ├── components/              # 11 个功能视图组件
│   │   ├── AgentOfficeView.tsx  # 智能体办公室（核心：工位+派发+日志+采购闭环）
│   │   ├── ChatView.tsx         # 对话工作台（三种消息样式）
│   │   ├── WelcomeScreen.tsx    # 对话欢迎页（快捷指令选择）
│   │   ├── InputBar.tsx         # 聊天输入框
│   │   ├── Sidebar.tsx          # 左侧导航栏（🐰 Logo + 10 项带文字）
│   │   ├── TitleBar.tsx         # 顶栏（搜索+品牌色+深浅色切换）
│   │   ├── CommandPalette.tsx   # ⌘K 命令面板
│   │   ├── DataView.tsx         # 数据看板（经营全景+库存/窜货预警+采购订单）
│   │   ├── ClientsView.tsx      # 客户/B2B（SaaS双向打通+字段映射+客户列表）
│   │   ├── KnowledgeView.tsx    # 知识库（上传/搜索/删除/私有隔离/绑定智能体）
│   │   ├── SkillsView.tsx       # 技能市场（安装/卸载 toggle）
│   │   ├── ModelsView.tsx       # 模型网关（商用/开源双选+连接测试+私有部署+按Agent绑定）
│   │   ├── CreditsView.tsx      # 算力积分中心（余额/充值/消耗明细账本）
│   │   ├── ConfigView.tsx       # 配置中心（双层配置+异常兜底+恢复出厂）
│   │   └── SettingsView.tsx     # 设置（外观+模型+安全+关于）
│   ├── store/
│   │   └── appStore.tsx         # 全局状态中枢（Context+useReducer）
│   ├── lib/
│   │   ├── dispatch.ts          # 中控意图识别+派发规则引擎
│   │   └── theme.tsx            # 主题系统（深/浅色 + 5 品牌色 + localStorage持久化）
│   └── data/
│       ├── mockAgents.ts        # 6 个智能体定义（中控A + 5业务）
│       └── mockSaaS.ts          # 医药 SaaS 数据底座 mock（商品/库存/订单/流向/客户/供应商）
├── dist/                        # Vite 构建产物
├── release/                     # electron-builder 打包产物
│   ├── AI数字员工-0.1.0-arm64.dmg
│   └── AI数字员工-0.1.0-arm64-mac.zip
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── postcss.config.js
├── index.html
└── .npmrc                       # 国内镜像配置（npmmirror）
```

---

## 4. 核心架构

### 4.1 智能体体系（6 Agent）

| ID | 名称 | Emoji | 职责 |
|----|------|-------|------|
| control | 中控 A Agent | 🧠 | 全局调度中枢：意图识别→派发→结果汇总 |
| ops | 运营智能体 | 📊 | 经营分析 / 促销测算 / 比价定价 / 报表 |
| crm | 跟客智能体 | 💬 | 客户自动跟进 / 话术生成 / 沟通台账 |
| purchase | 采购智能体 | 🛒 | 补货方案（最快/最优/均衡）+ 回写 SaaS 订单 |
| flow | 流向智能体 | 🗺️ | 窜货监控 / 渠道预警 / 滞销检测 |
| academic | 学术智能体 | 🎓 | 合规学术素材生成 / 患教内容 / 分层定制 |

每个智能体有：`enabled（启停开关）`、`status（idle/working/done）`、`progress（0-100%）`、`credits（消耗积分）`、`log（最近执行摘要）`。

### 4.2 对话驱动调度机制（跨视图任务通道）

```
用户输入指令（对话视图 / 办公室输入条）
  │
  ├─ dispatch.ts（规则引擎，预留 LLM 接缝）
  │    → 意图识别 + 智能体选择 + 商品实体抽取
  │
  ├─ 对话视图：先回人话确认（"好的老板，马上落实"~400ms）
  │    → 写入 pendingTask 到 appStore
  │
  ├─ 智能体办公室：useEffect 监听 pendingTask
  │    → 自动执行 runTask()
  │    → 分层日志（control/agent/saas/credit）
  │    → 进度动画 0%→100%
  │    → 扣算力积分 → 写入全局账本
  │
  ├─ 执行完毕 → setTaskResult 回写 result 到 appStore
  │
  └─ 对话视图：AppShell useEffect 监听 lastResult
       → 追加结果回报消息到对话
```

### 4.3 全局状态中枢（appStore）

统管 8 大领域数据，全部通过 Context+useReducer 跨视图共享：

- `agents`：6 个智能体状态（启停开关跨视图同步）
- `creditBalance / creditLedger`：算力积分余额与消耗明细账本
- `models`：9 个模型（商用 5 + 开源 4）含部署状态
- `knowledge`：8 篇知识文档（含绑定智能体、私有隔离标识）
- `saas`：5 个 SaaS 连接（双向回写开关、同步状态）
- `configs`：每智能体双层配置（出厂只读 + 企业自定义）
- `pendingTask / lastResult`：跨视图任务通道（对话→办公室→回传）
- `installedSkills`：4 个已安装技能

所有 "接真" 接缝已标注 `// TODO: 接入真实 XXX`，替换内部实现即可，视图无需改动。

### 4.4 主题系统

```
ThemeProvider（React Context）
  ├─ mode: 'dark' | 'light'     → body.theme-dark / body.theme-light
  └─ colorTheme: 5 色          → body.color-indigo/emerald/rose/amber/cyan

CSS 变量（RGB 通道）              Tailwind 颜色令牌
  :root { --bg-base: 11 13 18 }  → bg: { base: 'rgb(var(--bg-base) / <alpha-value>)' }
  body.theme-light { override }   → 透明度修饰符 bg-bg-base/40 正确编译
  body.color-emerald { accent }  → 渐变 from-accent 正确编译

持久化：localStorage('yesgo-theme')，重启应用后保留用户选择。
```

---

## 5. 视图功能清单

### 5.1 智能体办公室（AgentOfficeView）★ 核心视图

| 区域 | 功能 |
|------|------|
| 自然语言输入条 | 输入指令 → Enter 派发（同对话入口） |
| 中控 A 卡片 | 调度中状态、最近日志摘要 |
| 5 个智能体工位卡片 | 拟人动效、进度条、算力积分、启停开关 |
| 演示任务流按钮 | 一键运行「华东仓阿莫西林库存告急，帮我生成补货方案」 |
| 采购闭环结果卡 | 三套方案（最快/最优/均衡），含供应商/到货天数/预估价格，一键采纳回写 SaaS |
| 分层执行日志面板 | 四级日志（中控/智能体/SaaS/算力）+ 过滤按钮 |

### 5.2 对话工作台（ChatView + WelcomeScreen + InputBar）

| 功能 | 说明 |
|------|------|
| 欢迎页 | 4 个快捷指令按钮（补货/查窜货/经营分析/客户跟进） |
| 三种消息样式 | 普通消息 / 派发卡片（智能体 emoji+脉冲灯"正在执行"）/ 结果回报（绿色边框） |
| 两步回复流程 | 先人话确认 → 智能体派发 → 活干完自动汇报 |
| ⌘K 命令面板 | 全局搜索+视图导航+指令快捷输入 |
| 自适应输入框 | 最多 6 行自动滚动，支持 Shift+Enter 换行 |

### 5.3 数据看板（DataView）

- 经营概览卡片（商品数/库存/订单/客户/流向 5 指标）
- 库存预警列表（低于安全库存的 SKU × 仓库）
- 窜货异常列表（8 条流向记录含 3 条异常）
- 近期采购订单表（12 条历史订单，含状态标签）
- 数据推导洞察文案

### 5.4 客户 / B2B（ClientsView）

- 5 个 SaaS 数据源连接卡片（状态+最近同步时间+双向回写开关）
- SaaS 字段映射表（YesGo → SaaS 系统字段对应关系）
- 去授权入口（流转到真实 SaaS 授权页面）
- 客户列表（12 家药店/诊所，来自 CRM 底座）

### 5.5 知识库（KnowledgeView）

- 多格式文档卡片（PDF/DOC/XLS/PPT/MD）
- 搜索过滤（按名称/类型/文件夹）
- 删除按钮
- 私有隔离标签（按租户/客户）
- 绑定智能体展示
- 上传区域（mock 入库）

### 5.6 技能市场（SkillsView）

- 技能卡片网格（4 个已安装 + 4 个可安装）
- 安装/卸载 toggle（接 appStore.installedSkills）
- PageTitle + Section 组件被其他视图复用

### 5.7 模型网关（ModelsView）

- 商用模型区：通义千问-Max / 混元-Pro / GPT-4o / Claude 3.5 / 文心 4.0
- 开源模型区：Qwen2.5-72B / DeepSeek-V3 / Llama-3.1-70B / ChatGLM4-9B
- 每家模型状态标签（可用 / 部署中 / 未部署）
- 连接测试按钮（mock 返回 OK）
- 私有化部署按钮
- 每个智能体的模型绑定下拉选

### 5.8 算力积分（CreditsView）

- 余额卡片（含累计消耗统计）
- 充值套餐（5 档，含热门标识）
- 按智能体消耗占比进度条
- 消耗明细账本（读 appStore.creditLedger，含余额校验）

### 5.9 配置中心（ConfigView）

- 双层配置：出厂默认（只读浅灰底色） vs 企业自定义（可编辑深色底色）
- 每智能体：绑定模型 / temperature（滑块） / 超时重试次数 / 备用模型 / 人工接管阈值
- 恢复出厂默认按钮

### 5.10 设置（SettingsView）

- 外观面板：深色/浅色模式 + 5 品牌色选择（接 useTheme）
- 默认对话模型卡片
- 本地私有模型卡片
- B2B 系统对接 / 数据同步策略
- 安全与权限（数据隔离/操作审计/成员权限）
- 关于（版本/技术栈）

---

## 6. 数据底座（mockSaaS）

### 6.1 数据模型

| 实体 | 数量 | 说明 |
|------|------|------|
| 商品（Product） | 15 | 阿莫西林、头孢克肟等常用药品 |
| 库存（Inventory） | 40 | 6 个仓库（华东/华南/华北/西南/华中/电商），含大量低于安全库存记录 |
| 供应商（Supplier） | 5 | 九州通 3 仓 + 华润 + 上药 |
| 采购订单（Order） | 12 | 含状态标签（done/processing/pending） |
| 流向记录（Flow） | 8 | 含 3 条窜货异常（跨区域出售） |
| 客户（Customer） | 12 | 药店/诊所，含区域和评分 |

### 6.2 对外开放函数

```typescript
getProducts()      → Product[]
getShortages(sku)  → Inventory[]（低于安全库存）
getAllInventory()  → Inventory[]
getAllShortages()  → Inventory[]
getSuppliers()     → Supplier[]
getOrders()        → Order[]
submitOrder(sku, qty, supplier) → Order（mock 回写）
getCustomers()     → Customer[]
getFlows()         → FlowRecord[]
productName(sku)   → string
findProduct(text)  → Product | undefined（从自然语言提取商品实体）
```

---

## 7. 意图识别引擎（dispatch.ts）

规则引擎（关键词 + 实体抽取），输出 `DispatchResult{ agentId, intent, product?, confidence }`。

| 智能体 | 意图 | 命中关键词 |
|--------|------|-----------|
| purchase | 采购补货 | 采购、补货、进货、下单、订购、买、缺货、备货、库存 |
| crm | 客户跟进 | 客户、跟客、回访、药店、诊所、沟通、跟进、拜访 |
| ops | 经营分析 | 促销、活动、定价、比价、经营、分析、销量、报表、业绩 |
| flow | 流向监控 | 窜货、流向、滞销、预警、渠道、跨区域、异常 |
| academic | 学术内容 | 学术、合规、课件、培训、素材、患教、推广 |

兜底策略：关键词无命中但有商品名 → 默认派发采购智能体。

**接真入口**：`// TODO: 接入真实 LLM` —— 把 `dispatch(text)` 内部替换为 LLM function-calling 调用，返回同样结构即可。

---

## 8. 构建与部署

### 8.1 本地开发

```bash
npm install
npm run dev          # Vite dev server (port 5180) + Electron 窗口
```

### 8.2 构建前端

```bash
npm run build:vite   # tsc + vite build → dist/
```

### 8.3 打包 macOS 安装包

```bash
npm run build:mac    # electron-builder --mac → release/AI数字员工-0.1.0-arm64.dmg
```

**关键环境变量**：
- 必须清空 `ELECTRON_RUN_AS_NODE`（WorkBuddy 沙箱默认设为 1，会让 Electron 误当 Node 跑）
- `CSC_IDENTITY_AUTO_DISCOVERY=false`（跳过代码签名，未签名 dmg 首次打开需系统设置允许）
- `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`（国内镜像，否则从 GitHub 下载卡死）

### 8.4 打包 Windows

```bash
npm run build:win    # electron-builder --win (nsis)
```

### 8.5 .npmrc 国内镜像配置

```
registry=https://registry.npmmirror.com
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
```

---

## 9. 待接真清单（TODO）

当前所有模型/数据为 **mock 模拟**。以下位置已标注 `// TODO:`，接入真实服务后整个系统即可跑真实业务：

### 9.1 大模型接入

| 位置 | 说明 |
|------|------|
| `src/lib/dispatch.ts:54` | 把规则引擎替换为 LLM function-calling  |
| `src/components/AgentOfficeView.tsx` runTask() | 智能体执行阶段调用真实模型 |
| `src/components/ModelsView.tsx` | 连接测试接口替换为真实 API |

### 9.2 SaaS 数据对接

| 位置 | 说明 |
|------|------|
| `src/data/mockSaaS.ts` 所有读取函数 | 替换为真实 SaaS OpenAPI 调用 |
| `src/data/mockSaaS.ts submitOrder()` | 替换为真实订单创建 API |
| `src/components/ClientsView.tsx` 去授权 | 流转到真实 OAuth 授权流程 |

### 9.3 算力计费

| 位置 | 说明 |
|------|------|
| `src/store/appStore.tsx CONSUME_CREDITS` | 接入真实算力计费网关 |
| `src/store/appStore.tsx DEPLOY_MODEL` | 接入真实私有化部署编排 |
| `src/store/appStore.tsx ADD_DOC` | 接入真实向量化入库 |

---

## 10. 已知限制与注意事项

1. **沙箱环境无法启动 GUI**：WorkBuddy 沙箱禁止 macOS GPU 初始化和窗口弹出，只能打包成 dmg 让用户本地安装使用。
2. **未代码签名**：dmg 首次打开需进入「系统设置 → 隐私与安全性」点「仍要打开」。
3. **应用图标未替换**：目前使用 Electron 默认图标，白兔 Logo 是 UI 内的 emoji 🐰。
4. **postcss.config.js ESM 警告**：可在 package.json 加 `"type":"module"` 消除（不影响 .cjs 文件）。

---

## 11. 路线图

| 阶段 | 内容 | 状态 |
|------|------|------|
| P1 | 虚拟办公室（工位可视化 + 中控调度 + 分层日志） | ✅ 完成 |
| P2 | 业务闭环（对话派发 + 采购闭环 + 分层日志） | ✅ 完成 |
| P3 | 平台能力（模型网关/算力积分/配置中心/知识库/SaaS双向打通/主题系统） | ✅ 完成 |
| P4 | 对话体验升级（自然语言应答 + 智能体派发可视化 + 结果回报） | ✅ 完成 |
| P5 | 端到端逻辑跑通 + Bug 修复 + 功能完善 + 采购闭环增强 + 跨视图任务通道 | ✅ 完成 v0.2.1 |
| P6 | 接真：大模型 API + SaaS OpenAPI + 代码签名 | ⏳ 待用户提供凭证 |
| P7 | Windows 打包 + 移动端扩展 | 🔲 未开始 |

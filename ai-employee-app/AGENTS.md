# AGENTS.md

本仓库是 YesGo 医药行业 AI 数字员工桌面客户端（Electron App），与同事的后端 Django 多租户 SaaS 平台形成前后端分离闭环。

## 产品定位

- **桌面客户端**：Electron 33 + React 18 + TypeScript + Tailwind CSS 3，对标腾讯 Marvis 多智能体可视化协作体验
- **后端平台**（同事）：Django + DRF + PostgreSQL + Dify 智能体引擎 + Kafka + Docker Compose
- **管理后台**（同事）：Vue 3 + Ant Design Vue + Vite（stepin-template）
- **移动端**（同事）：uniapp

## 核心架构（已融入同事 AGENTS.md 规范）

### 多租户隔离
- 租户状态管理在 `appStore` 中（`tenant: TenantState`），含租户信息、成员关系、角色-智能体绑定、套餐配额
- API 请求通过 `X-Tenant-ID` 头隔离
- 租户套餐按智能体配置月度 Token 额度

### 五大智能体（对齐同事工作流码）
| 智能体 | 旧版 id | 工作流码 (AgentCode) | 职责 |
|--------|---------|---------------------|------|
| 采购智能体 | purchase | `procurement` | 三套采购方案 / 下单回写 |
| 运营智能体 | ops | `operations` | 经营分析 / 促销测算 |
| 跟客智能体 | crm | `marketing` | 客户自动沟通 / 跟进 |
| 流向智能体 | flow | `distribution` | 窜货监控 / 库存预警 |
| 学术智能体 | academic | `academic` | 学术内容生成 |

- 中控 A Agent 负责全局调度 + 意图识别派发
- `Agent.code` 字段对齐五大工作流码（向后兼容保留 `Agent.id`）

### Dify 智能体引擎
- 5 个平台级工作流，各自独立 API Key（不共享单一密钥）
- 租户个性化通过 `inputs` 注入：`tenant_code`、`role_code`、`tenant_config`
- Dify 职责：意图识别 + OCR + 闲聊回复
- 后端/客户端职责：状态机 / 缓存 / SKU 检索 / 方案测算 / 下单 / 审计
- 客户端集成层：`src/lib/dify.ts`

### 统一 API 响应
- 所有 API 返回 `{ code, msg, data }` 标准结构
- `code=0` 表示成功，业务码定义在 `src/lib/constants.ts`
- HTTP 客户端封装：`src/lib/api.ts`（Bearer Token 鉴权 + 自动刷新 + X-Tenant-ID）

### 调度引擎
- 双层架构：Dify 意图识别（第 1 层）→ 本地规则引擎（第 2 层，回退）
- `src/lib/dispatch.ts`：`dispatch(text)` 异步，`dispatchSync(text)` 同步兼容
- 派发结果含 `agentCode`（五大工作流码）+ `source`（dify/local）

## 技术栈

- Electron 33 + Vite 5 + React 18 + TypeScript + Tailwind CSS 3
- 图标：lucide-react
- 状态管理：React Context + useReducer（`src/store/appStore.tsx`）
- 主题系统：React Context + CSS 变量（5 色 + 深浅模式）
- 打包：electron-builder（mac: dmg/zip, win: nsis）

## 项目结构

```
ai-employee-app/
├── electron/
│   ├── main.cjs          # Electron 主进程
│   └── preload.cjs       # 预加载脚本
├── src/
│   ├── App.tsx           # 应用入口 + 对话调度 + 消息管理
│   ├── types.ts          # 核心类型（Agent/Tenant/API/Dify）
│   ├── components/
│   │   ├── Sidebar.tsx           # 侧边栏导航（🐰 Logo + 10 入口）
│   │   ├── TitleBar.tsx          # 标题栏（搜索/主题/颜色切换）
│   │   ├── AgentOfficeView.tsx   # 虚拟办公室（中控A + 5 工位）
│   │   ├── ChatView.tsx          # 对话视图（消息/派发卡片/结果回报）
│   │   ├── WelcomeScreen.tsx     # 欢迎屏
│   │   ├── InputBar.tsx          # 输入条
│   │   ├── CommandPalette.tsx    # 命令面板（⌘K）
│   │   ├── ModelsView.tsx        # 模型网关（商用/开源/部署）
│   │   ├── CreditsView.tsx       # 算力积分中心
│   │   ├── ConfigView.tsx        # 配置中心（双层配置 + Dify 连接）
│   │   ├── DataView.tsx          # 业务数据全景
│   │   ├── ClientsView.tsx       # SaaS 双向连接
│   │   ├── KnowledgeView.tsx     # 知识库管理
│   │   ├── SkillsView.tsx        # 技能市场
│   │   └── SettingsView.tsx      # 设置（外观/租户/Dify/API）
│   ├── store/
│   │   └── appStore.tsx          # 全局状态中枢
│   ├── lib/
│   │   ├── api.ts                # HTTP 客户端（标准响应 + Token + 租户）
│   │   ├── constants.ts          # 常量（AgentCode/业务码/路由前缀）
│   │   ├── dify.ts               # Dify 集成层（5 工作流 + Mock）
│   │   ├── dispatch.ts           # 意图识别 + 派发引擎
│   │   └── theme.tsx             # 主题系统（深浅色 + 5 品牌色）
│   ├── data/
│   │   ├── mockAgents.ts         # 智能体 Mock 数据
│   │   └── mockSaaS.ts           # SaaS 底座 Mock 数据
│   └── index.css                 # 全局样式 + CSS 变量
├── tailwind.config.js            # Tailwind 配色（CSS 变量驱动）
├── vite.config.ts
└── tsconfig.json
```

## 常用命令

```bash
# 开发（端口 5180）
npm run dev

# 仅构建前端（类型检查 + Vite）
npm run build:vite

# 打包 macOS dmg
ELECTRON_RUN_AS_NODE= CSC_IDENTITY_AUTO_DISCOVERY=false ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run build:mac

# 打包 Windows nsis
ELECTRON_RUN_AS_NODE= npm run build:win
```

## 关键配置

- `.npmrc`：国内镜像 npmmirror（registry + electron_mirror）
- Electron 主进程：mac `titleBarStyle: hiddenInset` + `vibrancy: under-window`
- Vite dev 端口：5180
- 主题存储：localStorage（`yesgo_theme_mode` / `yesgo_theme_color`）

## 待接真清单（TODO 接缝）

所有「接入真实 XXX」标注位置：

| 文件 | 标注 | 说明 |
|------|------|------|
| `src/lib/dify.ts` | 接入真实 Dify | 替换 Mock → 真实 `/v1/workflows/run` 调用 |
| `src/lib/dispatch.ts` | 接入真实 Dify | 取消注释 Dify 意图识别调用 |
| `src/lib/api.ts` | 接入真实后端 | 替换 fetch → 真实 API 端点 |
| `src/store/appStore.tsx` | 接入真实算力计费网关 | CONSUME_CREDITS action |
| `src/store/appStore.tsx` | 接入真实私有化部署编排 | DEPLOY_MODEL action |
| `src/store/appStore.tsx` | 接入真实向量化入库 | ADD_DOC action |
| `src/store/appStore.tsx` | 接入真实 Dify | TEST_DIFY_CONNECTION action |
| `src/data/mockSaaS.ts` | 接入真实 SaaS | 替换为真实 API 调用 |
| `src/components/ConfigView.tsx` | 接入真实配置下发 | 企业租户级持久化 |

## 沙箱限制

- WorkBuddy Bash 沙箱默认设 `ELECTRON_RUN_AS_NODE=1`，跑 electron 前必须清空
- 沙箱禁止 macOS sandbox/GPU，无法弹出 GUI 窗口；只能打包 dmg 让用户本地安装
- 未签名 dmg 首次打开需进「系统设置 → 隐私与安全性」点「仍要打开」

## 历史

- v0.1.0（2026-07-18）：P1 虚拟办公室 + P2 对话调度闭环 + P3 平台能力（模型/积分/配置/知识库/SaaS）+ 白兔 Logo + 侧边栏文字 + 深浅色/5 品牌色主题
- v0.2.0（2026-07-21）：融入同事 AGENTS.md 架构规范（多租户/Dify 集成/标准 API 响应/AgentCode 对齐/租户套餐/角色-智能体绑定）

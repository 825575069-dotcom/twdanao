# 工作流编辑器 + 智能体绑定工作流 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 管理后台新增可视化工作流模板编辑器（React Flow），智能体管理页支持绑定工作流模板（平台级 + 租户级覆盖），交互闭环。

**Architecture:** 后端 `Agent` / `AgentConfig` 新增 `WorkflowTemplate` 外键；前端用 `@xyflow/react` 实现全屏节点编辑器 `WorkflowEditor.tsx`；`Workflows.tsx` 从硬编码改为 API 驱动 + 新建/编辑/删除；`Agents.tsx` 加工作流模板下拉选择。

**Tech Stack:** Django DRF + React 18 + TypeScript + @xyflow/react + Tailwind CSS + Vite

---

## Task 1: 后端模型加外键 + 迁移

**Files:**
- Modify: `yesgo-backend/apps/platform/models.py` (Agent + AgentConfig)
- Create: `yesgo-backend/apps/platform/migrations/0007_agent_workflow_template_fk.py`

**Step 1:** 在 `Agent` 模型新增 `default_workflow_template` ForeignKey（null=True, on_delete=SET_NULL, related_name='agents'）

**Step 2:** 在 `AgentConfig` 模型新增 `custom_workflow_template` ForeignKey（null=True, on_delete=SET_NULL, related_name='agent_configs'）

**Step 3:** 运行 `python3 manage.py makemigrations platform --name agent_workflow_template_fk` 生成迁移

**Step 4:** 验证迁移文件生成成功，检查 `migrations/0007_*.py` 存在

---

## Task 2: 后端 Serializer 更新

**Files:**
- Modify: `yesgo-backend/apps/platform/serializers.py`

**Step 1:** `AgentSerializer.Meta.fields` 新增 `default_workflow_template_id`（IntegerField, source='default_workflow_template_id', read_only=False, allow_null=True）

**Step 2:** `AgentConfigSerializer.Meta.fields` 新增 `custom_workflow_template_id`

**Step 3:** `WorkflowTemplateSerializer.Meta.fields` 确认包含 `id, name, description, category, tags, steps, edges, enabled, sort_order`

---

## Task 3: 后端 Bug 修复

**Files:**
- Modify: `yesgo-backend/apps/platform/views_agent.py` (workflow_template_detail)

**Step 1:** 找到 `workflow_template_detail` 函数，PUT/DELETE 权限从 `platform.agents.manage` 改为 `platform.workflows.manage`

---

## Task 4: 前端类型补齐

**Files:**
- Modify: `yesgo-admin/src/types.ts`

**Step 1:** `WorkflowTemplate` 接口补 `category: string` / `tags: string[]` / `edges: WorkflowEdge[]` / `sort_order: number`

**Step 2:** `WorkflowStep` 接口补 `id: string` / `config: Record<string, any>`

**Step 3:** `WorkflowEdge` 接口：`id: string` / `from: string` / `to: string` / `type?: 'serial' | 'parallel'`

**Step 4:** `AgentInfo` 接口补 `default_workflow_template_id?: number` / `default_workflow_template_name?: string`

---

## Task 5: 前端 API 客户端

**Files:**
- Modify: `yesgo-admin/src/lib/api.ts`

**Step 1:** 新增 `getWorkflowTemplates()` → GET `/workflow-templates/`

**Step 2:** 新增 `createWorkflowTemplate(data)` → POST `/workflow-templates/create/`

**Step 3:** 新增 `updateWorkflowTemplate(id, data)` → PUT `/workflow-templates/<id>/`

**Step 4:** 新增 `deleteWorkflowTemplate(id)` → DELETE `/workflow-templates/<id>/`

**Step 5:** 新增 `getAgents()` → GET `/agents/`

**Step 6:** 新增 `updateAgent(id, data)` → PUT `/agents/<id>/`

---

## Task 6: 安装 @xyflow/react

**Step 1:** `cd yesgo-admin && /Users/chenshenghe/.workbuddy/binaries/node/versions/22.22.2/bin/npm install @xyflow/react`

**Step 2:** 验证 `package.json` 含 `@xyflow/react`

---

## Task 7: WorkflowEditor 组件

**Files:**
- Create: `yesgo-admin/src/components/workflow/WorkflowEditor.tsx`
- Create: `yesgo-admin/src/components/workflow/nodes.tsx`
- Create: `yesgo-admin/src/components/workflow/converters.ts`

**Step 1 (converters):** 实现 `stepsEdgesToFlow(steps, edges)` → React Flow `{ nodes, edges }` 和 `flowToStepsEdges(nodes, edges)` → 后端 `{ steps, edges }`

**Step 2 (nodes):** 自定义节点组件：TriggerNode（触发，只有右侧输出 handle）、ActionNode（业务，左右都有 handle）、ConditionNode（判断，双输出）、EndNode（结束，只有左侧输入）

**Step 3 (WorkflowEditor):** 全屏模态，左侧 NodePalette（可拖拽节点类型），中央 ReactFlow Canvas（onConnect 连线 + MiniMap + Controls），右侧 NodeProperties（选中节点显示名称/类型/配置 JSON 编辑器），顶部工具栏（模板名/描述/分类 + 保存/取消）

**Step 4:** onDrop 处理左侧拖拽到画布创建节点

**Step 5:** 保存时调 `createWorkflowTemplate` 或 `updateWorkflowTemplate`，成功后关闭并回调刷新

---

## Task 8: Workflows.tsx 改造

**Files:**
- Modify: `yesgo-admin/src/pages/Workflows.tsx`

**Step 1:** 移除 `WORKFLOW_TEMPLATES` 硬编码常量

**Step 2:** `useEffect` 调 `api.getWorkflowTemplates()` 加载列表到 state

**Step 3:** 右上角加「+ 新建工作流」按钮 → 打开 `WorkflowEditor`（mode=create）

**Step 4:** 卡片加「编辑」按钮 → 打开 `WorkflowEditor`（mode=edit，加载已有 steps/edges）

**Step 5:** 卡片加「删除」按钮 → 确认弹窗 → `api.deleteWorkflowTemplate(id)` → 刷新列表

**Step 6:** 启用/禁用开关 → `api.updateWorkflowTemplate(id, { enabled })` → 局部更新 state

---

## Task 9: Agents.tsx 改造

**Files:**
- Modify: `yesgo-admin/src/pages/Agents.tsx`

**Step 1:** 移除 `AGENT_DEFS` 硬编码，`useEffect` 调 `api.getAgents()` 加载

**Step 2:** `AgentCard` 配置区新增「工作流模板」下拉选择框：
  - 数据源 = `api.getWorkflowTemplates()` 返回的启用模板列表
  - 默认值 = `agent.default_workflow_template_id`
  - onChange → `api.updateAgent(agent.id, { default_workflow_template_id })` → 局部更新

**Step 3:** 卡片显示当前绑定的模板名（未绑定显示「未绑定」），点击可跳转 Workflows 编辑

---

## Task 10: 前端构建

**Step 1:** `cd yesgo-admin && /Users/chenshenghe/.workbuddy/binaries/node/versions/22.22.2/bin/npm run build`

**Step 2:** 确认 `dist/` 生成成功，无 TypeScript 错误

---

## Task 11: 后端部署 + migrate

**Step 1:** SCP 上传后端改动文件（models.py, serializers.py, views_agent.py, migration 0007）

**Step 2:** SSH 执行 `python3 manage.py migrate platform`

**Step 3:** 重启 Gunicorn

**Step 4:** 验证 API：`GET /workflow-templates/` 返回列表，`PUT /agents/<id>/` 带工作流模板 ID 返回成功

---

## Task 12: 前端部署

**Step 1:** tar 打包 `yesgo-admin/dist/`

**Step 2:** SCP 上传到 `/home/web/twdanao/admin/`

**Step 3:** 验证页面加载正常

---

## Task 13: 交互闭环验证

**Step 1:** 浏览器打开 `https://twdanao.88yldh.com/admin/` → 登录 admin/admin123

**Step 2:** 进入「工作流与知识库」→ 点「新建工作流」→ 拖拽节点 + 连线 → 保存 → 确认卡片出现

**Step 3:** 点新卡片「编辑」→ 确认节点/连线加载正确 → 修改 → 保存 → 确认更新

**Step 4:** 点「删除」→ 确认 → 卡片消失

**Step 5:** 进入「智能体管理」→ 打开某智能体配置 → 工作流模板下拉选择 → 保存 → 卡片显示模板名

**Step 6:** 刷新页面 → 确认配置持久化

---

## Task 14: 记忆更新

**Step 1:** 更新 `/Users/chenshenghe/WorkBuddy/2026-07-18-19-21-50/.workbuddy/memory/MEMORY.md` 记录工作流编辑器 + 智能体绑定设计

**Step 2:** 追加今日工作日志

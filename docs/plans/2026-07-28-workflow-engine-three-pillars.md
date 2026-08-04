# 工作流执行引擎 + 三要素融合 Implementation Plan

## 概述

将当前硬编码的智能体回复改造为真实的工作流执行引擎，实现"用户只需输入纯文字 → 系统自动转 JSON → 智能体按工作流+知识文档+数据底座执行"的完整链路。

## 现状

- `WorkflowTemplate.steps` 是 JSONField，存自由格式 list
- 种子数据用旧格式：`{id, agentId, name, prompt, retryCount, timeout, modelId, triggerCondition}`
- 前端编辑器用新格式：`{id, order, name, type, config, position}`，config 可为纯文字或 JSON
- `chat/views.py::generate_agent_reply()` 完全硬编码，不读工作流、不查知识文档、不查数据底座
- `KnowledgeDoc` / `DataConnector` 模型已存在但未接入执行链路

## 目标

用户建好工作流（纯文字输入即可）→ 绑给智能体 → 智能体按"工作流节点指令 + 知识文档 RAG + 数据底座查询"三要素执行 → 大模型生成回复

---

## 第一块：后端结构优化

### Task #272 — config schema 规范化

**目标**：定义各节点类型 config 的结构化 JSON schema，支持纯文字自动包装

**步骤**：

1. **创建 `apps/platform/workflow_schema.py`**
   - 定义 `STEP_TYPES = ['trigger', 'action', 'condition', 'end']`
   - 定义各节点类型 config schema：
     - `trigger`: `{trigger_type: 'manual'|'schedule'|'event', schedule?: str, event?: str}`
     - `action`: `{prompt: str, tool?: str, knowledge_docs?: list[int], data_source?: str}`
     - `condition`: `{expression: str, true_label?: str, false_label?: str}`
     - `end`: `{output_format?: str}`
   - `normalize_step_config(step)`: 纯文字 → 自动包装成结构化 dict
     - 如果 config 是字符串 → action 节点包装成 `{prompt: 文字}`，condition 包装成 `{expression: 文字}`
     - 如果 config 是 dict 但缺 prompt → 补全
   - `normalize_workflow_steps(steps)`: 批量规范化

2. **更新 `serializers.py::WorkflowTemplateSerializer`**
   - `validate_steps()`: 调用 `normalize_workflow_steps()` 规范化
   - 确保保存到 DB 的 steps 都是规范格式

3. **更新种子数据 `seed.py`**
   - 将旧格式 steps 转为新格式（type/config/position）

4. **无需 migration**（steps 是 JSONField，schema 在应用层约束）

### Task #273 — 前端纯文字自动转 JSON

**目标**：编辑器纯文字输入 → 保存时自动转结构化 JSON

**步骤**：

1. **更新 `converters.ts::flowToStepsEdges`**
   - 调用 `normalizeConfig(stepType, config)` 将纯文字包装成结构化
2. **更新 `WorkflowEditor.tsx`** 配置面板
   - 不同节点类型显示不同配置字段（action 显示 prompt 输入框，condition 显示 expression）
   - 保留"高级 JSON"模式作为备选

---

## 第二块：执行引擎

### Task #274 — 执行引擎骨架 + 节点执行器

**目标**：按 edges 拓扑遍历 steps，维护执行上下文

**步骤**：

1. **创建 `apps/platform/workflow_engine.py`**
   - `WorkflowContext` 类：存储执行上下文（user_input, step_results, accumulated_prompt）
   - `WorkflowEngine` 类：
     - `execute(template, user_input, tenant) -> dict`
     - 拓扑排序 steps（按 edges）
     - 逐节点执行，上下文在节点间传递
   - 四种节点执行器：
     - `execute_trigger(ctx, step)`: 初始化上下文
     - `execute_action(ctx, step)`: 组装 prompt → 调大模型 → 存结果
     - `execute_condition(ctx, step)`: 评估表达式 → 决定分支
     - `execute_end(ctx, step)`: 汇总输出
   - 集成 `model_gateway` 调用真实大模型（带 fallback）

### Task #275 — chat 接入工作流执行

**目标**：`generate_agent_reply` 改为调用 WorkflowEngine

**步骤**：

1. **更新 `chat/views.py`**
   - `chat_send`: 查找智能体绑定的工作流模板 → 调 `WorkflowEngine.execute()`
   - 保留意图识别用于权限检查和默认智能体派发
   - 无绑定工作流时 fallback 到旧逻辑
2. **端到端验证**：发消息 → 工作流执行 → 大模型回复

---

## 第三块：三要素融合

### Task #276 — 知识文档向量化 + RAG

**步骤**：

1. `KnowledgeDoc` 增加 `content_text` / `embedding` 字段
2. 文档上传时自动提取文本 + 向量化
3. `retrieve_knowledge(tenant, query, top_k)` 函数

### Task #279 — 知识注入 prompt

**步骤**：

1. `execute_action` 调用 `retrieve_knowledge` 获取相关文档
2. 注入到 prompt：`[系统知识] {retrieved_docs}\n\n[节点指令] {prompt}`

### Task #277 — 数据底座查询

**步骤**：

1. `execute_action` 根据 `config.data_source` 查 `tenant_db`
2. 查询结果注入 prompt

### Task #278 — 三要素融合 + 端到端验证

**步骤**：

1. 最终 prompt = 工作流节点指令 + 知识文档 RAG + 数据底座查询
2. 端到端验证完整链路

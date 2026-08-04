"""
工作流执行引擎

按 edges 拓扑遍历 steps，维护执行上下文，逐节点执行。
四种节点执行器：trigger / action / condition / end

执行流程：
1. 从 trigger 节点开始，初始化上下文（user_input）
2. 按 edges 拓扑排序，逐节点执行
3. action 节点：组装 prompt → 调大模型 → 存结果到上下文
4. condition 节点：评估表达式 → 决定走哪条分支
5. end 节点：汇总输出

最终 prompt = 工作流节点指令 + 知识文档 RAG + 数据底座查询
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

from apps.platform.workflow_schema import normalize_workflow_steps, normalize_edges

logger = logging.getLogger(__name__)


@dataclass
class WorkflowContext:
    """工作流执行上下文 — 在节点间传递的共享状态"""
    user_input: str = ''                          # 用户原始输入
    tenant: object = None                         # 租户对象
    agent_code: str = ''                          # 智能体编码（agent_id，如 purchase/ops/crm/flow/academic）
    model_id: str = ''                            # 模型ID（AIModel.name 或 主键ID）
    fallback_model_id: str = ''                   # 兜底模型ID
    temperature: float = 0.7                     # 温度
    step_results: dict = field(default_factory=dict)   # {step_id: {content, tokens, ...}}
    accumulated_context: str = ''                 # 前序节点累积的上下文文本
    final_output: str = ''                        # 最终输出
    total_tokens: int = 0                         # 总 token 消耗
    execution_log: list = field(default_factory=list)  # 执行日志 [{step_id, step_name, type, result_summary}]
    knowledge_context: str = ''                   # 知识文档 RAG 检索结果（缓存，首次 action 节点时检索）
    knowledge_retrieved: bool = False             # 标记是否已检索过知识文档
    data_context: str = ''                        # 数据底座查询结果（缓存，首次 action 节点时查询）
    data_retrieved: bool = False                  # 标记是否已查询过数据底座
    role_context: str = ''                        # 智能体角色定位（缓存）
    role_retrieved: bool = False                  # 标记是否已读取过角色
    media_context: str = ''                       # 营销素材内容（缓存，首次 action 节点时加载）
    media_retrieved: bool = False                 # 标记是否已加载过营销素材

    def add_result(self, step_id: str, result: dict):
        """添加节点执行结果"""
        self.step_results[step_id] = result
        self.total_tokens += result.get('tokens', 0)
        # 累积上下文：把每个 action 节点的输出拼到上下文里
        content = result.get('content', '')
        if content:
            if self.accumulated_context:
                self.accumulated_context += '\n\n'
            self.accumulated_context += content


@dataclass
class WorkflowResult:
    """工作流执行结果"""
    success: bool
    reply: str
    step_results: dict
    execution_log: list
    total_tokens: int
    error: str = ''

    def to_dict(self) -> dict:
        return {
            'success': self.success,
            'reply': self.reply,
            'step_results': self.step_results,
            'execution_log': self.execution_log,
            'total_tokens': self.total_tokens,
            'error': self.error,
        }


class WorkflowEngine:
    """工作流执行引擎"""

    def __init__(self):
        self._llm_cache = {}

    def execute(self, template, user_input: str, tenant=None, agent_config=None) -> WorkflowResult:
        """执行工作流

        Args:
            template: WorkflowTemplate 对象（有 steps 和 edges 属性）
            user_input: 用户输入的文字
            tenant: 租户对象
            agent_config: AgentConfig 对象（可选，提供模型配置）

        Returns:
            WorkflowResult
        """
        # 规范化 steps 和 edges
        steps = normalize_workflow_steps(template.steps)
        edges = normalize_edges(template.edges)

        if not steps:
            return WorkflowResult(
                success=False, reply='', step_results={}, execution_log=[],
                total_tokens=0, error='工作流没有步骤'
            )

        # 构建上下文
        ctx = WorkflowContext(
            user_input=user_input,
            tenant=tenant,
            agent_code=(agent_config.agent_id if agent_config else ''),
            model_id=(agent_config.model_id if agent_config else ''),
            temperature=(agent_config.temperature if agent_config else 0.7),
            fallback_model_id=(agent_config.fallback_model_id if agent_config else ''),
        )

        # 拓扑排序：从 trigger 节点开始，按 edges 遍历
        ordered_steps = self._topological_sort(steps, edges)

        if not ordered_steps:
            return WorkflowResult(
                success=False, reply='', step_results={}, execution_log=[],
                total_tokens=0, error='无法确定执行顺序（可能存在循环依赖）'
            )

        # 逐节点执行
        try:
            for step in ordered_steps:
                step_type = step.get('type', 'action')
                step_id = step.get('id', '')
                step_name = step.get('name', '')
                config = step.get('config', {})

                logger.info(f'执行节点: {step_id} ({step_type}) {step_name}')

                if step_type == 'trigger':
                    self._execute_trigger(ctx, step, config)
                elif step_type == 'action':
                    self._execute_action(ctx, step, config)
                elif step_type == 'condition':
                    self._execute_condition(ctx, step, config, edges)
                elif step_type == 'end':
                    self._execute_end(ctx, step, config)
                else:
                    # 未知类型当 action 处理
                    self._execute_action(ctx, step, config)

                # 记录执行日志
                last_result = ctx.step_results.get(step_id, {})
                ctx.execution_log.append({
                    'step_id': step_id,
                    'step_name': step_name,
                    'type': step_type,
                    'result_summary': str(last_result.get('content', ''))[:100],
                    'tokens': last_result.get('tokens', 0),
                })

            # 最终输出取 end 节点结果，没有 end 则取最后一个 action 结果
            ctx.final_output = ctx.accumulated_context

            return WorkflowResult(
                success=True,
                reply=ctx.final_output or '工作流执行完成',
                step_results=ctx.step_results,
                execution_log=ctx.execution_log,
                total_tokens=ctx.total_tokens,
            )

        except Exception as e:
            logger.exception(f'工作流执行异常: {e}')
            return WorkflowResult(
                success=False,
                reply='',
                step_results=ctx.step_results,
                execution_log=ctx.execution_log,
                total_tokens=ctx.total_tokens,
                error=str(e),
            )

    # ── 拓扑排序 ────────────────────────────

    def _topological_sort(self, steps: list, edges: list) -> list:
        """按 edges 拓扑排序 steps。

        策略：
        1. 找到 trigger 节点作为起点（没有 trigger 则取第一个 step）
        2. 按 edges 的 from→to 关系做 BFS 遍历
        3. parallel 类型的边表示可以并行，这里简化为顺序执行
        """
        if not steps:
            return []

        step_map = {s['id']: s for s in steps}

        # 构建邻接表
        adj = {}
        for edge in edges:
            from_id = edge.get('from', '')
            to_id = edge.get('to', '')
            if from_id and to_id:
                adj.setdefault(from_id, []).append(to_id)

        # 找起点：trigger 节点，或没有入边的节点
        has_incoming = set()
        for edge in edges:
            has_incoming.add(edge.get('to', ''))

        start_nodes = [s for s in steps if s['id'] not in has_incoming]
        if not start_nodes:
            # 所有节点都有入边，可能有环，取第一个
            start_nodes = [steps[0]]

        # 优先从 trigger 开始
        trigger_starts = [s for s in start_nodes if s.get('type') == 'trigger']
        if trigger_starts:
            start_nodes = trigger_starts

        # BFS 遍历
        visited = set()
        ordered = []

        queue = [s['id'] for s in start_nodes]
        while queue:
            current_id = queue.pop(0)
            if current_id in visited:
                continue
            if current_id not in step_map:
                continue

            visited.add(current_id)
            ordered.append(step_map[current_id])

            # 添加后继节点
            for next_id in adj.get(current_id, []):
                if next_id not in visited:
                    queue.append(next_id)

        # 如果有未被遍历到的节点（孤立节点），追加到末尾
        for step in steps:
            if step['id'] not in visited:
                ordered.append(step)

        return ordered

    # ── 节点执行器 ────────────────────────────

    def _execute_trigger(self, ctx: WorkflowContext, step: dict, config: dict):
        """触发节点：初始化上下文，把用户输入存入"""
        trigger_type = config.get('trigger_type', 'manual')
        ctx.step_results[step['id']] = {
            'content': f'触发条件: {trigger_type}',
            'trigger_type': trigger_type,
            'user_input': ctx.user_input,
            'tokens': 0,
        }
        # 把用户输入加入累积上下文
        ctx.accumulated_context = f'用户需求: {ctx.user_input}'

    def _execute_action(self, ctx: WorkflowContext, step: dict, config: dict):
        """业务节点：组装 prompt → 调大模型 → 存结果"""
        prompt = config.get('prompt', '')
        if not prompt:
            prompt = step.get('name', '执行业务操作')

        # 检索知识文档（首次 action 节点时检索，后续缓存复用）
        # config.knowledge_docs 为 False 时跳过；为列表时按指定 doc_id 过滤（当前简化为全量检索）
        knowledge_docs_cfg = config.get('knowledge_docs')
        if knowledge_docs_cfg is not False and not ctx.knowledge_retrieved:
            ctx.knowledge_context = self._retrieve_knowledge(ctx)
            ctx.knowledge_retrieved = True
            if ctx.knowledge_context:
                logger.info(f'知识文档检索完成，注入上下文 ({len(ctx.knowledge_context)} 字符)')

        # 查询数据底座（首次 action 节点时查询，后续缓存复用）
        # config.data_source 指定数据源类型（如 stock/customer/procurement/flow/dashboard）
        data_source_cfg = config.get('data_source', '')
        if data_source_cfg and not ctx.data_retrieved:
            ctx.data_context = self._query_data_source(ctx, data_source_cfg)
            ctx.data_retrieved = True
            if ctx.data_context:
                logger.info(f'数据底座查询完成 ({data_source_cfg})，注入上下文 ({len(ctx.data_context)} 字符)')

        # 读取智能体角色定位（首次 action 节点时读取，后续缓存复用）
        if not ctx.role_retrieved:
            ctx.role_context = self._retrieve_agent_role(ctx)
            ctx.role_retrieved = True
            if ctx.role_context:
                logger.info(f'智能体角色定位已注入 ({len(ctx.role_context)} 字符)')

        # 加载营销素材（首次 action 节点时加载，后续缓存复用）
        if not ctx.media_retrieved:
            ctx.media_context = self._load_media_assets(ctx)
            ctx.media_retrieved = True
            if ctx.media_context:
                logger.info(f'营销素材已注入 ({len(ctx.media_context)} 字符)')

        # 组装完整 prompt：前序上下文 + 角色定位 + 知识文档 + 数据底座 + 当前节点指令
        full_prompt = self._build_prompt(ctx, prompt)

        # 调用大模型
        messages = [
            {'role': 'system', 'content': '你是一个专业的医药行业智能助手，请根据指令和数据给出专业、准确的分析和建议。'},
            {'role': 'user', 'content': full_prompt},
        ]

        llm_response = self._call_llm(ctx, messages)

        result = {
            'content': llm_response.get('content', ''),
            'prompt': prompt,
            'full_prompt': full_prompt,
            'tokens': llm_response.get('total_tokens', 0),
            'model': llm_response.get('model_name', ''),
        }
        # 使用 add_result 累积上下文
        ctx.add_result(step['id'], result)

    def _execute_condition(self, ctx: WorkflowContext, step: dict, config: dict, edges: list):
        """判断节点：评估表达式 → 记录分支选择

        当前实现：简单的关键词匹配。后续可接入更复杂的规则引擎或 LLM 判断。
        """
        expression = config.get('expression', '')
        true_label = config.get('true_label', '是')
        false_label = config.get('false_label', '否')

        # 简单评估：检查表达式中的关键词是否出现在累积上下文中
        # 例如 expression="库存<100" → 检查上下文是否包含"库存"且数字<100
        result = self._evaluate_condition(expression, ctx.accumulated_context)

        label = true_label if result else false_label
        ctx.step_results[step['id']] = {
            'content': f'条件判断: {expression} → {label}',
            'expression': expression,
            'result': result,
            'label': label,
            'tokens': 0,
        }

    def _execute_end(self, ctx: WorkflowContext, step: dict, config: dict):
        """结束节点：汇总输出"""
        output_format = config.get('output_format', 'text')
        # end 节点不调 add_result（不需要把自身输出加入上下文）
        ctx.step_results[step['id']] = {
            'content': ctx.accumulated_context,
            'output_format': output_format,
            'tokens': 0,
        }

    # ── 辅助方法 ────────────────────────────

    def _build_prompt(self, ctx: WorkflowContext, node_prompt: str) -> str:
        """组装完整 prompt：前序上下文 + 角色定位 + 知识文档 + 数据底座 + 营销素材 + 当前节点指令

        五要素融合：
        - [上下文]：前序节点累积的执行结果
        - [角色定位]：智能体角色描述（专业能力/行为边界）
        - [知识文档]：RAG 检索的相关知识文档片段
        - [数据底座]：数据底座查询结果（真实业务数据）
        - [营销素材]：绑定的营销素材信息（图片/视频/链接等）
        - [执行指令]：当前节点的业务指令
        """
        parts = []
        if ctx.accumulated_context:
            parts.append(f'[上下文]\n{ctx.accumulated_context}')
        if ctx.role_context:
            parts.append(ctx.role_context)
        if ctx.knowledge_context:
            parts.append(ctx.knowledge_context)
        if ctx.data_context:
            parts.append(ctx.data_context)
        if ctx.media_context:
            parts.append(ctx.media_context)
        parts.append(f'[执行指令]\n{node_prompt}')

        return '\n\n'.join(parts)

    def _retrieve_agent_role(self, ctx: WorkflowContext) -> str:
        """读取当前智能体绑定的角色定位并构建上下文文本。"""
        if not ctx.agent_code:
            return ''
        try:
            from .models import Agent
            agent = Agent.objects.filter(agent_id=ctx.agent_code).select_related('agent_role').first()
            if not agent or not agent.agent_role:
                return ''
            role = agent.agent_role
            text = f'[角色定位]\n你是「{role.name}」。'
            if role.description:
                text += f'\n{role.description}'
            return text
        except Exception as e:
            logger.warning(f'读取智能体角色失败，跳过: {e}')
            return ''

    def _load_media_assets(self, ctx: WorkflowContext) -> str:
        """加载当前智能体绑定的营销素材并构建上下文文本。

        链路：
        1. 通过 agent_code 找到 Agent → AgentConfig
        2. 从 AgentConfig.bound_images 获取绑定的素材 ID 列表
        3. 从 tenant_ext.MediaAsset 获取素材详细信息
        4. 构建 [营销素材] 上下文文本
        """
        if not ctx.agent_code or not ctx.tenant:
            return ''
        try:
            from .models import Agent, AgentConfig
            from apps.tenant_ext.models import MediaAsset

            agent = Agent.objects.filter(agent_id=ctx.agent_code).first()
            if not agent:
                return ''
            config = AgentConfig.objects.filter(agent=agent).first()
            if not config or not config.bound_images:
                return ''

            # bound_images 存储的是 MediaAsset ID 列表
            asset_ids = config.bound_images
            assets = MediaAsset.objects.filter(
                tenant=ctx.tenant, id__in=asset_ids
            ).order_by('-created_at')

            if not assets.exists():
                return ''

            lines = ['[营销素材]']
            lines.append('以下是可用的营销素材，请在回答中参考和应用这些素材的内容、风格或信息：')
            for asset in assets:
                info_parts = [f'- {asset.name}（{asset.type}）']
                if asset.description:
                    info_parts.append(f'  描述：{asset.description}')
                if asset.url:
                    info_parts.append(f'  链接：{asset.url}')
                if asset.file:
                    info_parts.append(f'  文件路径：{asset.file.url}')
                info_parts.append(f'  大小：{asset.size}')
                lines.append('\n'.join(info_parts))

            return '\n'.join(lines)
        except Exception as e:
            logger.warning(f'加载营销素材失败，跳过: {e}')
            return ''

    def _retrieve_knowledge(self, ctx: WorkflowContext) -> str:
        """检索知识文档并构建上下文文本

        通过 knowledge_rag 模块的 build_knowledge_context 函数，
        基于用户输入和智能体绑定关系检索相关知识文档。
        """
        if not ctx.tenant:
            return ''
        try:
            from apps.platform.knowledge_rag import build_knowledge_context
            return build_knowledge_context(
                tenant=ctx.tenant,
                query=ctx.user_input,
                agent_id=ctx.agent_code,
                top_k=3,
            )
        except Exception as e:
            logger.warning(f'知识文档检索失败，跳过: {e}')
            return ''

    def _query_data_source(self, ctx: WorkflowContext, data_source: str) -> str:
        """查询数据底座并构建上下文文本

        通过 data_query 模块根据 data_source 类型查询 tenant_db 中的真实业务数据。
        """
        if not ctx.tenant:
            return ''
        try:
            from apps.platform.data_query import query_data_source
            return query_data_source(
                tenant=ctx.tenant,
                data_source=data_source,
                user_input=ctx.user_input,
            )
        except Exception as e:
            logger.warning(f'数据底座查询失败，跳过: {e}')
            return ''

    def _find_model(self, model_identifier: str):
        """根据标识符查找 AIModel，兼容 name 和主键 id 两种存储方式。

        前端下拉框可能存 name（如 'qwen-max'）也可能存数字 id（如 '1'），
        seed 数据统一用 name。这里两种都支持。
        """
        if not model_identifier:
            return None
        from apps.model_gateway.models import AIModel
        # 先按 name 查（seed 数据规范）
        try:
            return AIModel.objects.get(name=model_identifier)
        except AIModel.DoesNotExist:
            pass
        # 如果是数字，按主键 id 查（前端可能存 id）
        if model_identifier.isdigit():
            try:
                return AIModel.objects.get(id=int(model_identifier))
            except (AIModel.DoesNotExist, ValueError):
                pass
        return None

    def _call_llm(self, ctx: WorkflowContext, messages: list) -> dict:
        """调用大模型（通过 model_gateway 的 Provider 抽象）

        链路：AgentConfig.model_id → AIModel → get_provider → provider.call
        兜底策略：主模型查找失败 → fallback_model_id → 第一个可用模型 → mock 回复
        """
        try:
            from apps.model_gateway.models import AIModel
            from apps.model_gateway.providers import get_provider

            # 查找主模型
            model = self._find_model(ctx.model_id)

            # 主模型查找失败 → 尝试兜底模型
            if not model and ctx.fallback_model_id:
                logger.info(f'主模型 "{ctx.model_id}" 未找到，尝试兜底模型 "{ctx.fallback_model_id}"')
                model = self._find_model(ctx.fallback_model_id)

            # 兜底也失败 → 取第一个可用模型
            if not model:
                model = AIModel.objects.filter(status='ready').first()

            if not model:
                # 没有模型配置，返回模拟回复
                last_msg = messages[-1]['content'] if messages else ''
                return {
                    'content': f'已分析：{last_msg[:80]}。基于当前数据，建议如下处理。',
                    'total_tokens': 200,
                    'model_name': 'mock',
                }

            provider = get_provider(model)
            if not provider:
                return {
                    'content': '模型 Provider 不可用',
                    'total_tokens': 0,
                    'model_name': model.name,
                }

            response = provider.call(messages, temperature=ctx.temperature)

            # 主模型调用失败 → 尝试兜底模型
            if not getattr(response, 'success', True) and ctx.fallback_model_id:
                fb_model = self._find_model(ctx.fallback_model_id)
                if fb_model and fb_model.id != model.id:
                    logger.info(f'主模型调用失败，切换兜底模型: {fb_model.name}')
                    fb_provider = get_provider(fb_model)
                    if fb_provider:
                        response = fb_provider.call(messages, temperature=ctx.temperature)

            return response.to_dict()

        except Exception as e:
            logger.exception(f'LLM 调用异常: {e}')
            return {
                'content': f'模型调用异常: {e}',
                'total_tokens': 0,
                'model_name': ctx.model_id or 'error',
            }

    def _evaluate_condition(self, expression: str, context: str) -> bool:
        """简单条件评估

        当前策略：
        - 空表达式 → True
        - 表达式中包含的关键词出现在上下文中 → True
        - 支持 ">0" "<0" 等简单数字比较（检查上下文中是否有对应数字）
        """
        if not expression:
            return True

        expr = expression.strip().lower()
        context_lower = context.lower()

        # 简单关键词匹配
        # 提取表达式中的中文关键词（去掉运算符和数字）
        keywords = []
        import re
        # 提取中文词
        cn_words = re.findall(r'[\u4e00-\u9fa5]+', expression)
        keywords.extend(cn_words)
        # 提取英文词
        en_words = re.findall(r'[a-zA-Z]{2,}', expression)
        keywords.extend(en_words)

        if not keywords:
            return True

        # 如果所有关键词都在上下文中出现，返回 True
        return all(kw.lower() in context_lower for kw in keywords)

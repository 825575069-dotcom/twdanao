"""
工作流 config schema 规范化模块

定义各节点类型的结构化 config schema，并提供纯文字自动包装能力。
用户在前端只需输入纯文字，系统自动按节点类型包装成结构化 JSON。

节点 config schema:
  trigger:  {trigger_type, schedule?, event?}
  action:   {prompt, tool?, knowledge_docs?, data_source?}
  condition:{expression, true_label?, false_label?}
  end:      {output_format?}
"""

import logging

logger = logging.getLogger(__name__)

# ── 节点类型 ────────────────────────────

STEP_TYPES = ['trigger', 'action', 'condition', 'end']

# ── 各节点类型 config schema 定义 ────────────────────────────

STEP_CONFIG_SCHEMA = {
    'trigger': {
        'required': [],
        'optional': ['trigger_type', 'schedule', 'event'],
        'defaults': {'trigger_type': 'manual'},
    },
    'action': {
        'required': ['prompt'],
        'optional': ['tool', 'knowledge_docs', 'data_source'],
        'defaults': {'prompt': ''},
    },
    'condition': {
        'required': ['expression'],
        'optional': ['true_label', 'false_label'],
        'defaults': {'expression': '', 'true_label': '是', 'false_label': '否'},
    },
    'end': {
        'required': [],
        'optional': ['output_format'],
        'defaults': {'output_format': 'text'},
    },
}


def normalize_config(step_type, config):
    """将单个节点的 config 规范化为结构化 dict。

    支持三种输入：
    1. 纯文字字符串 → 按节点类型自动包装
       - action:    "分析库存"  →  {"prompt": "分析库存"}
       - condition: "库存<100"  →  {"expression": "库存<100"}
       - trigger:   "手动"      →  {"trigger_type": "manual"}
       - end:       "text"      →  {"output_format": "text"}
    2. dict → 补全缺失的 required 字段
    3. None/空 → 返回 defaults
    """
    schema = STEP_CONFIG_SCHEMA.get(step_type, STEP_CONFIG_SCHEMA['action'])
    result = dict(schema['defaults'])

    if config is None or config == '':
        return result

    # 纯文字 → 包装
    if isinstance(config, str):
        text = config.strip()
        if not text:
            return result
        if step_type == 'action':
            result['prompt'] = text
        elif step_type == 'condition':
            result['expression'] = text
        elif step_type == 'trigger':
            # 纯文字视为触发类型描述
            result['trigger_type'] = 'manual'
            if '定时' in text or '每天' in text or '每周' in text:
                result['trigger_type'] = 'schedule'
                result['schedule'] = text
            else:
                result['event'] = text
        elif step_type == 'end':
            result['output_format'] = text
        else:
            result['prompt'] = text
        return result

    # dict → 合并，补全缺失字段
    if isinstance(config, dict):
        # 剥离可能残留的 position 字段（旧数据兼容）
        config = {k: v for k, v in config.items() if k != 'position'}

        # 检查是否有纯文字嵌套在某个字段里（旧数据可能 {"prompt": "文字"} 已 OK）
        for key in schema['required'] + schema['optional']:
            if key in config and config[key] is not None:
                result[key] = config[key]

        # 特殊处理：action 节点如果 config 里有文字但没 prompt 字段，
        # 尝试从常见旧字段名提取
        if step_type == 'action' and not result.get('prompt'):
            for old_key in ['description', 'text', 'content', 'instruction']:
                if old_key in config and isinstance(config[old_key], str):
                    result['prompt'] = config[old_key]
                    break
            # 如果还是没有 prompt，但 dict 本身就是 {"文字": "..."} 的形式
            if not result.get('prompt'):
                for v in config.values():
                    if isinstance(v, str) and len(v) > 5:
                        result['prompt'] = v
                        break

        # condition 节点同理
        if step_type == 'condition' and not result.get('expression'):
            for old_key in ['rule', 'condition', 'text']:
                if old_key in config and isinstance(config[old_key], str):
                    result['expression'] = config[old_key]
                    break

        return result

    # 其他类型 → 转字符串当 prompt
    result['prompt'] = str(config)
    return result


def normalize_step(step):
    """规范化单个 step dict。

    确保有 id, order, name, type, config, position 字段。
    config 调用 normalize_config 规范化。
    """
    if not isinstance(step, dict):
        return None

    step_type = step.get('type', 'action')
    if step_type not in STEP_TYPES:
        step_type = 'action'

    # 兼容旧种子数据格式：旧格式有 agentId/prompt/retryCount 等字段
    old_config = step.get('config')
    if old_config is None:
        # 旧种子数据没有 config 字段，从 prompt 等字段组装
        if step_type == 'action' and 'prompt' in step:
            old_config = {'prompt': step['prompt']}
            # 保留其他可能有用的旧字段
            for old_key in ['tool', 'modelId', 'retryCount', 'timeout', 'data_source', 'knowledge_docs']:
                if old_key in step:
                    old_config[old_key] = step[old_key]
        elif step_type == 'condition' and 'triggerCondition' in step:
            old_config = {'expression': step['triggerCondition']}
        elif step_type == 'trigger' and 'triggerCondition' in step:
            old_config = {'trigger_type': 'manual', 'event': step['triggerCondition']}
        else:
            old_config = {}

    normalized_config = normalize_config(step_type, old_config)

    # position 兼容
    position = step.get('position')
    if not position or not isinstance(position, dict):
        # 旧数据可能把 position 塞在 config 里
        if isinstance(old_config, dict) and 'position' in old_config:
            position = old_config['position']
        else:
            position = {'x': 0, 'y': 0}

    return {
        'id': step.get('id', f'step_{step.get("order", 0)}'),
        'order': step.get('order', 0),
        'name': step.get('name', '未命名节点'),
        'type': step_type,
        'config': normalized_config,
        'position': {
            'x': position.get('x', 0) if isinstance(position, dict) else 0,
            'y': position.get('y', 0) if isinstance(position, dict) else 0,
        },
    }


def normalize_workflow_steps(steps):
    """批量规范化 steps 列表。

    输入可以是新格式（type/config/position）或旧格式（agentId/prompt/...）。
    输出统一为新格式，config 为结构化 dict。
    """
    if not isinstance(steps, list):
        return []

    normalized = []
    for idx, step in enumerate(steps):
        result = normalize_step(step)
        if result is None:
            continue
        # 确保 order 连续
        result['order'] = idx
        normalized.append(result)

    return normalized


def normalize_edges(edges):
    """规范化 edges 列表，确保每个 edge 有 id/from/to/type。"""
    if not isinstance(edges, list):
        return []

    normalized = []
    for idx, edge in enumerate(edges):
        if not isinstance(edge, dict):
            continue
        from_id = edge.get('from') or edge.get('source', '')
        to_id = edge.get('to') or edge.get('target', '')
        if not from_id or not to_id:
            continue
        edge_type = edge.get('type', 'serial')
        # 兼容旧种子数据的 'sequential' 写法
        if edge_type == 'sequential':
            edge_type = 'serial'
        normalized.append({
            'id': edge.get('id', f'edge_{idx}'),
            'from': from_id,
            'to': to_id,
            'type': edge_type,
        })

    return normalized

// 工作流数据转换层：后端 steps/edges ↔ React Flow nodes/edges
import type { Node, Edge } from '@xyflow/react';
import type { WorkflowStep, WorkflowEdge } from '@/types';

// 节点类型映射：后端 step.type → React Flow node.type
export const NODE_TYPES = ['trigger', 'action', 'condition', 'end'] as const;
export type NodeType = (typeof NODE_TYPES)[number];

// ── config 规范化：纯文字 → 结构化 JSON ───────────────────
// 与后端 workflow_schema.py 对齐，前端保存时也做一次规范化
export function normalizeConfig(
  stepType: string,
  config: unknown,
): Record<string, unknown> {
  // 默认结构
  const defaults: Record<string, Record<string, unknown>> = {
    trigger: { trigger_type: 'manual' },
    action: { prompt: '' },
    condition: { expression: '', true_label: '是', false_label: '否' },
    end: { output_format: 'text' },
  };
  const result: Record<string, unknown> = { ...(defaults[stepType] || defaults.action) };

  if (config === null || config === undefined || config === '') return result;

  // 纯文字 → 按节点类型包装
  if (typeof config === 'string') {
    const text = config.trim();
    if (!text) return result;
    if (stepType === 'action') {
      result['prompt'] = text;
    } else if (stepType === 'condition') {
      result['expression'] = text;
    } else if (stepType === 'trigger') {
      if (text.includes('定时') || text.includes('每天') || text.includes('每周')) {
        result['trigger_type'] = 'schedule';
        result['schedule'] = text;
      } else {
        result['trigger_type'] = 'manual';
        result['event'] = text;
      }
    } else if (stepType === 'end') {
      result['output_format'] = text;
    } else {
      result['prompt'] = text;
    }
    return result;
  }

  // dict → 合并，补全缺失字段
  if (typeof config === 'object' && !Array.isArray(config)) {
    const cfg = config as Record<string, unknown>;
    // 剥离可能残留的 position 字段
    const { position: _p, ...rest } = cfg;
    for (const key of Object.keys(rest)) {
      if (rest[key] !== null && rest[key] !== undefined) {
        result[key] = rest[key];
      }
    }
    // action 节点：如果没有 prompt，尝试从旧字段提取
    if (stepType === 'action' && !result['prompt']) {
      for (const oldKey of ['description', 'text', 'content', 'instruction']) {
        if (typeof cfg[oldKey] === 'string') {
          result['prompt'] = cfg[oldKey];
          break;
        }
      }
    }
    // condition 节点：如果没有 expression，尝试从旧字段提取
    if (stepType === 'condition' && !result['expression']) {
      for (const oldKey of ['rule', 'condition', 'text']) {
        if (typeof cfg[oldKey] === 'string') {
          result['expression'] = cfg[oldKey];
          break;
        }
      }
    }
    return result;
  }

  // 其他类型 → 转字符串当 prompt
  result['prompt'] = String(config);
  return result;
}

// 从结构化 config 提取纯文字用于编辑器显示
export function configToText(stepType: string, config: unknown): string {
  // 兼容空字符串、空对象、空 JSON 字符串等多种空配置形态
  if (config === null || config === undefined) return '';
  if (typeof config === 'string') {
    const text = config.trim();
    if (text === '{}' || text === '') return '';
    return text;
  }
  if (Array.isArray(config)) return '';
  if (typeof config === 'object') {
    const cfg = config as Record<string, unknown>;
    // 如果是空对象，直接返回空
    if (Object.keys(cfg).length === 0) return '';
    if (stepType === 'action') return String(cfg['prompt'] || '');
    if (stepType === 'condition') return String(cfg['expression'] || '');
    if (stepType === 'trigger') return String(cfg['event'] || cfg['schedule'] || '');
    if (stepType === 'end') return String(cfg['output_format'] || '');
  }
  return '';
}

// 后端 steps + edges → React Flow nodes + edges
export function stepsEdgesToFlow(
  steps: WorkflowStep[],
  edges: WorkflowEdge[],
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = steps.map((step, idx) => {
    // 兼容旧数据：position 可能存在 config.position 里
    const legacyPos = typeof step.config === 'object'
      ? (step.config as Record<string, unknown>).position as { x?: number; y?: number } | undefined
      : undefined;
    const pos = step.position || legacyPos || {};
    // config 剥离 position，只保留用户配置
    const userConfig = typeof step.config === 'object'
      ? (() => {
          const { position: _p, ...rest } = step.config as Record<string, unknown>;
          return rest;
        })()
      : step.config;
    return {
      id: step.id || `node_${idx}`,
      type: step.type,
      position: pos.x != null && pos.y != null
        ? { x: Number(pos.x), y: Number(pos.y) }
        : { x: 80 + (idx % 4) * 220, y: 80 + Math.floor(idx / 4) * 160 },
      data: {
        name: step.name,
        stepType: step.type,
        config: userConfig ?? '',
      },
    };
  });

  const flowEdges: Edge[] = edges.map((e, idx) => ({
    id: e.id || `edge_${idx}`,
    source: e.from,
    target: e.to,
    type: 'smoothstep',
    animated: e.type === 'parallel',
  }));

  return { nodes, edges: flowEdges };
}

// React Flow nodes + edges → 后端 steps + edges（保存时规范化 config）
export function flowToStepsEdges(
  nodes: Node[],
  edges: Edge[],
): { steps: WorkflowStep[]; edges: WorkflowEdge[] } {
  const steps: WorkflowStep[] = nodes.map((node, idx) => {
    const stepType = (node.data as { stepType?: string }).stepType || node.type || 'action';
    const rawConfig = (node.data as { config?: unknown }).config;
    const normalizedStepType = (NODE_TYPES as readonly string[]).includes(stepType)
      ? (stepType as WorkflowStep['type'])
      : 'action';
    // 保存时规范化 config：纯文字自动包装成结构化 JSON
    const normalizedConfig = normalizeConfig(normalizedStepType, rawConfig);
    return {
      id: node.id,
      order: idx,
      name: (node.data as { name: string }).name || '未命名节点',
      type: normalizedStepType,
      config: normalizedConfig,
      position: { x: node.position.x, y: node.position.y },
    };
  });

  const wfEdges: WorkflowEdge[] = edges.map((e, idx) => ({
    id: e.id || `edge_${idx}`,
    from: e.source,
    to: e.target,
    type: e.animated ? 'parallel' : 'serial',
  }));

  return { steps, edges: wfEdges };
}

// 节点类型配置（图标/颜色/标签）
export const NODE_CONFIG: Record<
  NodeType,
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  trigger: {
    label: '触发节点',
    icon: '⚡',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-300',
  },
  action: {
    label: '业务节点',
    icon: '⚙️',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
  },
  condition: {
    label: '判断节点',
    icon: '🔀',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-300',
  },
  end: {
    label: '结束节点',
    icon: '🏁',
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-300',
  },
};

let nodeIdCounter = 0;
export function genNodeId(): string {
  nodeIdCounter += 1;
  return `node_${Date.now()}_${nodeIdCounter}`;
}

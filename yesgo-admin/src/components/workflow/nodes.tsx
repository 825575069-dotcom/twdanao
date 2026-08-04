// 自定义节点组件 — 对应 trigger/action/condition/end 四种类型
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NODE_CONFIG, configToText, type NodeType } from './converters';

interface WorkflowNodeData {
  name: string;
  stepType: NodeType;
  config?: string | Record<string, unknown>;
  [key: string]: unknown;
}

const handleStyle = {
  width: 12,
  height: 12,
  background: '#6b7280',
  border: '2px solid #fff',
};

function BaseNode({ id, data, selected }: NodeProps) {
  const nodeData = data as WorkflowNodeData;
  const cfg = NODE_CONFIG[nodeData.stepType] || NODE_CONFIG.action;
  const configText = configToText(nodeData.stepType, nodeData.config);
  // 当用户未自定义节点名称（仍为默认类型标签）时，不再显示重复的黑色文字
  const showName = nodeData.name && nodeData.name !== cfg.label && nodeData.name !== '未命名';

  return (
    <div
      className={`min-w-[200px] max-w-[280px] cursor-pointer select-none rounded-xl border-2 ${cfg.border} ${cfg.bg} px-4 py-3 shadow-sm transition-shadow ${
        selected ? 'ring-2 ring-indigo-400 shadow-md' : ''
      }`}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {/* trigger: 只有右侧输出 */}
      {nodeData.stepType !== 'trigger' && (
        <Handle type="target" position={Position.Left} style={handleStyle} />
      )}

      <div className="flex items-start gap-3 pointer-events-none">
        <span className="text-xl shrink-0">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</div>
          {showName && (
            <div className="truncate text-sm font-semibold text-gray-800">
              {nodeData.name}
            </div>
          )}
          {configText && (
            <div className="mt-1 line-clamp-3 text-xs text-gray-500 break-words leading-relaxed">
              {configText}
            </div>
          )}
        </div>
      </div>

      {/* end: 只有左侧输入 */}
      {nodeData.stepType !== 'end' && (
        <Handle type="source" position={Position.Right} style={handleStyle} />
      )}
      {/* condition: 双输出（上下） */}
      {nodeData.stepType === 'condition' && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="branch-false"
            style={{ ...handleStyle, left: '30%' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="branch-true"
            style={{ ...handleStyle, left: '70%' }}
          />
        </>
      )}
    </div>
  );
}

export const TriggerNode = memo(BaseNode);
export const ActionNode = memo(BaseNode);
export const ConditionNode = memo(BaseNode);
export const EndNode = memo(BaseNode);

export const nodeTypesMap = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  end: EndNode,
};

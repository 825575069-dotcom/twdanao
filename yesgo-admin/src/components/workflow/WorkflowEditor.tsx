// 工作流编辑器 — 全屏模态，基于 @xyflow/react
// 左侧节点面板 + 中央画布 + 右侧属性面板 + 顶部工具栏
import { useCallback, useState, useMemo, useEffect, type DragEvent, type ChangeEvent } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { X, Save, Trash2, Plus } from 'lucide-react';
import type { WorkflowTemplate, WorkflowStep, WorkflowEdge } from '@/types';
import { api } from '@/lib/api';
import {
  stepsEdgesToFlow,
  flowToStepsEdges,
  NODE_TYPES,
  NODE_CONFIG,
  genNodeId,
  configToText,
  type NodeType,
} from './converters';
import { nodeTypesMap } from './nodes';

interface WorkflowEditorProps {
  mode: 'create' | 'edit';
  template?: WorkflowTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}

function EditorInner({ mode, template, onClose, onSaved }: WorkflowEditorProps) {
  // 顶部表单
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [category, setCategory] = useState(template?.category || '通用');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 画布状态
  const initial = useMemo(() => {
    if (template?.steps?.length) {
      return stepsEdgesToFlow(template.steps, template.edges || []);
    }
    return { nodes: [], edges: [] };
  }, [template]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [configEdit, setConfigEdit] = useState('');

  const { screenToFlowPosition } = useReactFlow();

  // 连线
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: false }, eds)),
    [setEdges],
  );

  // 选中节点
  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

  // 左侧拖拽到画布
  const onDragStart = (e: DragEvent, nodeType: NodeType) => {
    e.dataTransfer.setData('application/reactflow', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('application/reactflow') as NodeType;
    if (!nodeType || !NODE_TYPES.includes(nodeType)) return;

    const position = screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    });

    const newNode: Node = {
      id: genNodeId(),
      type: nodeType,
      position,
      data: {
        name: NODE_CONFIG[nodeType].label,
        stepType: nodeType,
        config: '',
      },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  // 选中节点数据
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  // 更新选中节点属性
  const updateSelectedNode = (field: 'name' | 'config', value: unknown) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id
          ? { ...n, data: { ...n.data, [field]: value } as Record<string, unknown> }
          : n,
      ),
    );
  };

  // 删除选中节点
  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNodeId(null);
  };

  // 保存
  const handleSave = async () => {
    setError('');
    if (!name.trim()) {
      setError('请输入工作流名称');
      return;
    }
    if (nodes.length === 0) {
      setError('请至少添加一个节点');
      return;
    }

    const { steps, edges: wfEdges } = flowToStepsEdges(nodes, edges);
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        tags: [],
        steps,
        edges: wfEdges,
        enabled: true,
        sort_order: 0,
      };
      if (mode === 'create') {
        await api.createWorkflowTemplate(payload);
      } else if (template) {
        await api.updateWorkflowTemplate(template.id, payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 配置编辑：从结构化 config 提取纯文字显示，输入时直接存原始文字
  useEffect(() => {
    if (!selectedNode) {
      setConfigEdit('');
      return;
    }
    const stepType = (selectedNode.data as { stepType?: string }).stepType || 'action';
    const cfg = (selectedNode.data as { config?: unknown }).config;
    setConfigEdit(configToText(stepType, cfg));
  }, [selectedNode]);

  const onConfigChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setConfigEdit(value);
    if (!selectedNode) return;
    // 直接存原始文字，flowToStepsEdges 保存时自动规范化为结构化 JSON
    updateSelectedNode('config', value);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="工作流名称"
            className="w-56 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="分类"
            className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="描述（选填）"
            className="w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        <div className="flex-1" />

        {error && <span className="text-sm text-red-500">{error}</span>}

        <button
          onClick={onClose}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          <X size={16} /> 取消
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Save size={16} /> {saving ? '保存中...' : '保存'}
        </button>
      </div>

      {/* 主体三栏 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧节点面板 */}
        <div className="w-48 shrink-0 border-r border-gray-200 bg-white p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            节点类型
          </div>
          <div className="space-y-2">
            {NODE_TYPES.map((nt) => {
              const cfg = NODE_CONFIG[nt];
              return (
                <div
                  key={nt}
                  draggable
                  onDragStart={(e) => onDragStart(e, nt)}
                  className={`flex cursor-grab items-center gap-2 rounded-lg border ${cfg.border} ${cfg.bg} px-3 py-2 text-sm transition-shadow hover:shadow-sm active:cursor-grabbing`}
                >
                  <span className="text-base">{cfg.icon}</span>
                  <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-6 border-t border-gray-100 pt-3">
            <div className="text-xs text-gray-400">提示：从左侧拖拽节点到画布</div>
          </div>
        </div>

        {/* 中央画布 */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypesMap as NodeTypes}
            fitView
            className="h-full w-full"
            defaultEdgeOptions={{ type: 'smoothstep' }}
          >
            <Background gap={16} size={1} color="#e5e7eb" />
            <Controls className="!bg-white !shadow-sm !rounded-lg" />
            <MiniMap
              className="!rounded-lg !shadow-sm"
              maskColor="rgba(0,0,0,0.05)"
              nodeColor={(n) => {
                const st = (n.data as { stepType?: string }).stepType;
                if (st === 'trigger') return '#fb923c';
                if (st === 'condition') return '#a78bfa';
                if (st === 'end') return '#34d399';
                return '#60a5fa';
              }}
            />
          </ReactFlow>
        </div>

        {/* 右侧属性面板 */}
        <div className="w-64 shrink-0 border-l border-gray-200 bg-white p-4">
          {selectedNode ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  节点属性
                </span>
                <button
                  onClick={deleteSelectedNode}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                >
                  <Trash2 size={14} /> 删除
                </button>
              </div>

              <div>
                <label className="mb-1 block text-xs text-gray-500">节点名称</label>
                <input
                  type="text"
                  value={(selectedNode.data as { name: string }).name || ''}
                  onChange={(e) => updateSelectedNode('name', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-gray-500">节点类型</label>
                <div className="rounded-lg bg-gray-50 px-3 py-1.5 text-sm text-gray-600">
                  {NODE_CONFIG[(selectedNode.data as { stepType: NodeType }).stepType]?.label || '未知'}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  {(() => {
                    const st = (selectedNode.data as { stepType: NodeType }).stepType;
                    if (st === 'action') return '执行指令（输入文字即可）';
                    if (st === 'condition') return '判断条件（输入文字即可）';
                    if (st === 'trigger') return '触发说明（输入文字即可）';
                    if (st === 'end') return '输出格式（输入文字即可）';
                    return '配置 / 文案备注';
                  })()}
                </label>
                <textarea
                  value={configEdit}
                  onChange={onConfigChange}
                  rows={10}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  placeholder={(() => {
                    const st = (selectedNode.data as { stepType: NodeType }).stepType;
                    if (st === 'action') return '例如：读取各仓库库存数据，对比安全库存阈值，生成预警清单';
                    if (st === 'condition') return '例如：库存低于安全线';
                    if (st === 'trigger') return '例如：手动触发 / 每天定时触发';
                    if (st === 'end') return '例如：text';
                    return '输入该节点的执行说明';
                  })()}
                />
                <p className="mt-1 text-xs text-gray-400">
                  直接输入文字即可，系统保存时自动转为结构化配置
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center text-sm text-gray-400">
              <Plus size={24} className="mb-2 opacity-40" />
              <p>选中画布上的节点</p>
              <p>查看和编辑属性</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkflowEditor(props: WorkflowEditorProps) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  );
}

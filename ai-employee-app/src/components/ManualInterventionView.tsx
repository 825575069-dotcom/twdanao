import { useState } from 'react'
import {
  Hand,
  Plus,
  Trash2,
  Edit3,
  Clock,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  X,
  Save,
} from 'lucide-react'

interface TriggerRule {
  id: string
  name: string
  type: 'keyword' | 'sentiment' | 'no_reply' | 'custom'
  condition: string
  enabled: boolean
}

interface InterventionConfig {
  enabled: boolean
  workingHours: {
    start: string
    end: string
    weekdays: boolean[]
  }
  autoHandoff: boolean
  handoffMessage: string
  rules: TriggerRule[]
}

const defaultConfig: InterventionConfig = {
  enabled: true,
  workingHours: {
    start: '09:00',
    end: '18:00',
    weekdays: [true, true, true, true, true, false, false],
  },
  autoHandoff: true,
  handoffMessage: '您好，我是人工客服，很高兴为您服务。请问有什么可以帮助您的？',
  rules: [
    {
      id: '1',
      name: '客户主动要求人工',
      type: 'keyword',
      condition: '人工,人工客服,转人工,找人工,真人客服',
      enabled: true,
    },
    {
      id: '2',
      name: 'AI连续无法回复',
      type: 'no_reply',
      condition: 'AI连续3次无法理解用户意图',
      enabled: true,
    },
    {
      id: '3',
      name: '负面情绪检测',
      type: 'sentiment',
      condition: '检测到客户表达不满或投诉倾向',
      enabled: true,
    },
  ],
}

const ruleTypeLabels: Record<TriggerRule['type'], string> = {
  keyword: '关键词触发',
  sentiment: '情绪检测',
  no_reply: '无回复超时',
  custom: '自定义',
}

const ruleTypeColors: Record<TriggerRule['type'], string> = {
  keyword: 'bg-blue-100 text-blue-700',
  sentiment: 'bg-orange-100 text-orange-700',
  no_reply: 'bg-purple-100 text-purple-700',
  custom: 'bg-gray-100 text-gray-700',
}

const weekdayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export default function ManualInterventionView() {
  const [config, setConfig] = useState<InterventionConfig>(defaultConfig)
  const [editingRule, setEditingRule] = useState<TriggerRule | null>(null)
  const [showAddRule, setShowAddRule] = useState(false)

  const updateConfig = (partial: Partial<InterventionConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }))
  }

  const toggleRule = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    }))
  }

  const deleteRule = (id: string) => {
    setConfig((prev) => ({ ...prev, rules: prev.rules.filter((r) => r.id !== id) }))
  }

  const saveRule = (rule: TriggerRule) => {
    if (editingRule) {
      setConfig((prev) => ({
        ...prev,
        rules: prev.rules.map((r) => (r.id === rule.id ? rule : r)),
      }))
    } else {
      setConfig((prev) => ({
        ...prev,
        rules: [...prev.rules, { ...rule, id: String(Date.now()) }],
      }))
    }
    setEditingRule(null)
    setShowAddRule(false)
  }

  return (
    <div className="h-full overflow-y-auto bg-bg-base p-6">
      {/* 页头 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-text-primary">
            <Hand className="h-6 w-6 text-[#07c160]" />
            人工介入设置
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            配置 AI 托管转人工的触发条件与接管策略
          </p>
        </div>
        <button
          onClick={() => updateConfig({ enabled: !config.enabled })}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            config.enabled
              ? 'bg-[#07c160] text-white hover:bg-[#06ad56]'
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
          }`}
        >
          {config.enabled ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {config.enabled ? '已启用' : '已停用'}
        </button>
      </div>

      <div className={`space-y-4 ${config.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
        {/* 基础设置 */}
        <div className="rounded-xl border border-border-subtle bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Clock className="h-4 w-4 text-text-muted" />
            基础设置
          </h2>
          <div className="space-y-4">
            {/* 自动转接 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">自动转接人工</p>
                <p className="text-xs text-text-muted">触发条件满足时自动将对话转给人工客服</p>
              </div>
              <button
                onClick={() => updateConfig({ autoHandoff: !config.autoHandoff })}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  config.autoHandoff ? 'bg-[#07c160]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    config.autoHandoff ? 'left-[calc(100%-1.25rem)]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* 工作时间 */}
            <div>
              <p className="mb-2 text-sm font-medium text-text-primary">人工客服工作时间</p>
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={config.workingHours.start}
                  onChange={(e) =>
                    updateConfig({
                      workingHours: { ...config.workingHours, start: e.target.value },
                    })
                  }
                  className="rounded-lg border border-border-subtle px-3 py-1.5 text-sm"
                />
                <span className="text-text-muted">至</span>
                <input
                  type="time"
                  value={config.workingHours.end}
                  onChange={(e) =>
                    updateConfig({
                      workingHours: { ...config.workingHours, end: e.target.value },
                    })
                  }
                  className="rounded-lg border border-border-subtle px-3 py-1.5 text-sm"
                />
              </div>
              <div className="mt-2 flex gap-2">
                {weekdayLabels.map((day, i) => (
                  <button
                    key={day}
                    onClick={() => {
                      const weekdays = [...config.workingHours.weekdays]
                      weekdays[i] = !weekdays[i]
                      updateConfig({ workingHours: { ...config.workingHours, weekdays } })
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                      config.workingHours.weekdays[i]
                        ? 'bg-[#07c160] text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            {/* 接管话术 */}
            <div>
              <p className="mb-2 text-sm font-medium text-text-primary">人工接管话术</p>
              <textarea
                value={config.handoffMessage}
                onChange={(e) => updateConfig({ handoffMessage: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-primary outline-none focus:border-[#07c160]"
                placeholder="人工客服接管对话时发送的欢迎语"
              />
            </div>
          </div>
        </div>

        {/* 触发规则 */}
        <div className="rounded-xl border border-border-subtle bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <AlertCircle className="h-4 w-4 text-text-muted" />
              触发规则
            </h2>
            <button
              onClick={() => {
                setEditingRule(null)
                setShowAddRule(true)
              }}
              className="flex items-center gap-1 rounded-lg bg-[#07c160] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#06ad56]"
            >
              <Plus className="h-3.5 w-3.5" />
              添加规则
            </button>
          </div>

          <div className="space-y-3">
            {config.rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-start gap-3 rounded-lg border border-border-subtle p-3 hover:border-[#07c160]/30"
              >
                <div className="mt-0.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{rule.name}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ruleTypeColors[rule.type]}`}>
                      {ruleTypeLabels[rule.type]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">{rule.condition}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      rule.enabled ? 'bg-[#07c160]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        rule.enabled ? 'left-[calc(100%-1.125rem)]' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => {
                      setEditingRule(rule)
                      setShowAddRule(true)
                    }}
                    className="text-gray-400 hover:text-[#07c160]"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 说明 */}
        <div className="rounded-xl bg-[#f0f9eb] p-4">
          <div className="flex gap-2">
            <MessageSquare className="h-4 w-4 shrink-0 text-[#07c160]" />
            <div className="text-xs text-[#666]">
              <p className="font-medium text-[#333]">使用说明</p>
              <ul className="mt-1 space-y-0.5">
                <li>1. 启用后，AI 托管对话在满足触发条件时将自动转接人工</li>
                <li>2. 非工作时间内触发将创建待处理任务，人工上线后处理</li>
                <li>3. 可添加多个触发规则，满足任一条件即触发转接</li>
                <li>4. 人工接管后 AI 将暂停自动回复，直到人工结束接管</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 添加/编辑规则弹窗 */}
      {showAddRule && (
        <RuleEditModal
          rule={editingRule}
          onSave={saveRule}
          onClose={() => {
            setEditingRule(null)
            setShowAddRule(false)
          }}
        />
      )}
    </div>
  )
}

/** 规则编辑弹窗 */
function RuleEditModal({
  rule,
  onSave,
  onClose,
}: {
  rule: TriggerRule | null
  onSave: (rule: TriggerRule) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<TriggerRule>(
    rule || {
      id: '',
      name: '',
      type: 'keyword',
      condition: '',
      enabled: true,
    }
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-[420px] rounded-xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            {rule ? '编辑规则' : '添加规则'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-text-muted">规则名称</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="如：客户主动要求人工"
              className="w-full rounded-lg border border-border-subtle px-3 py-2 text-sm outline-none focus:border-[#07c160]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">触发类型</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as TriggerRule['type'] })}
              className="w-full rounded-lg border border-border-subtle px-3 py-2 text-sm outline-none focus:border-[#07c160]"
            >
              <option value="keyword">关键词触发</option>
              <option value="sentiment">情绪检测</option>
              <option value="no_reply">无回复超时</option>
              <option value="custom">自定义</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">
              {form.type === 'keyword'
                ? '关键词（逗号分隔）'
                : form.type === 'no_reply'
                ? '超时条件描述'
                : '条件描述'}
            </label>
            <textarea
              value={form.condition}
              onChange={(e) => setForm({ ...form, condition: e.target.value })}
              rows={3}
              placeholder={
                form.type === 'keyword'
                  ? '人工,转人工,人工客服'
                  : '请描述触发条件'
              }
              className="w-full rounded-lg border border-border-subtle px-3 py-2 text-sm outline-none focus:border-[#07c160]"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border-subtle px-4 py-1.5 text-sm text-text-secondary hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={() => form.name.trim() && onSave(form)}
            disabled={!form.name.trim()}
            className="flex items-center gap-1 rounded-lg bg-[#07c160] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#06ad56] disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

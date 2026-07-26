import { useState, useEffect, useRef, type KeyboardEvent } from 'react'
import {
  Search,
  MessageSquarePlus,
  History,
  Bot,
  LayoutGrid,
  FileText,
  Image,
  BarChart3,
  ShieldCheck,
  Coins,
  Settings,
  CornerDownLeft,
  Cpu,
  Sparkles,
  Building2,
  SlidersHorizontal
} from 'lucide-react'
import type { ViewKey } from '../App'

interface Props {
  onClose: () => void
  onNavigate: (v: ViewKey) => void
}

const commands: {
  key: ViewKey
  title: string
  desc: string
  icon: typeof MessageSquarePlus
  group: string
}[] = [
  { key: 'chat', title: '新建对话', desc: '与数字员工开始新对话', icon: MessageSquarePlus, group: '对话' },
  { key: 'tasks', title: '自动任务', desc: '定时任务与执行记录', icon: History, group: '对话' },
  { key: 'office', title: 'AI 办公室', desc: '中控调度与可视化协作', icon: Bot, group: '对话' },
  { key: 'dataBase', title: '数据底座', desc: 'SaaS 数据资产与连接', icon: LayoutGrid, group: '企业知识库' },
  { key: 'knowledge', title: '知识文档', desc: '管理企业文档与资料', icon: FileText, group: '企业知识库' },
  { key: 'media', title: '营销素材', desc: '营销物料与 AI 素材', icon: Image, group: '企业知识库' },
  { key: 'skills', title: '技能市场', desc: '安装与管理工作流技能', icon: Sparkles, group: '企业知识库' },
  { key: 'data', title: '经营看板', desc: '经营全景与预警', icon: BarChart3, group: '企业管理' },
  { key: 'clients', title: '客户管理', desc: '客户列表与 B2B 对接', icon: Building2, group: '企业管理' },
  { key: 'permissions', title: '权限管理', desc: '成员、角色与访问控制', icon: ShieldCheck, group: '企业管理' },
  { key: 'credits', title: '积分管理', desc: '余额、充值与消耗明细', icon: Coins, group: '企业管理' },
  { key: 'models', title: '模型网关', desc: '商用与开源模型管理', icon: Cpu, group: '企业管理' },
  { key: 'config', title: '配置中心', desc: '智能体参数与异常兜底', icon: SlidersHorizontal, group: '企业管理' },
  { key: 'settings', title: '系统设置', desc: '模型、主题与连接配置', icon: Settings, group: '企业管理' }
]

export default function CommandPalette({ onClose, onNavigate }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtered = commands.filter(
    (c) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.desc.toLowerCase().includes(query.toLowerCase()) ||
      c.group.toLowerCase().includes(query.toLowerCase())
  )

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[active]) onNavigate(filtered[active].key)
    }
  }

  // 按 group 分组
  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = []
    acc[cmd.group].push(cmd)
    return acc
  }, {})
  let globalIdx = 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] animate-fade-in"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-bg-elevated/95 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 搜索框 */}
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
          <Search className="h-4 w-4 text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="搜索命令或跳转…"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <kbd className="rounded border border-border-subtle px-1.5 py-0.5 text-[10px] text-text-muted">
            ESC
          </kbd>
        </div>

        {/* 结果 — 按分组聚合 */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-text-muted">
              没有匹配的命令
            </div>
          ) : (
            Object.entries(grouped).map(([groupName, cmds]) => (
              <div key={groupName} className="mb-1">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted/60">
                  {groupName}
                </div>
                {cmds.map((cmd) => {
                  const i = globalIdx++
                  const Icon = cmd.icon
                  return (
                    <button
                      key={cmd.key}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => onNavigate(cmd.key)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        i === active ? 'bg-accent-soft' : 'hover:bg-bg-hover'
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          i === active ? 'bg-accent text-white' : 'bg-bg-surface text-text-secondary'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-text-primary">{cmd.title}</div>
                        <div className="truncate text-xs text-text-muted">
                          {cmd.desc}
                        </div>
                      </div>
                      {i === active && (
                        <CornerDownLeft className="h-3.5 w-3.5 text-text-muted" />
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border-subtle px-4 py-2 text-[11px] text-text-muted">
          ↑↓ 选择 · Enter 确认
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import {
  FileText,
  Users,
  Search,
  GraduationCap,
  BarChart3,
  TrendingDown,
  ArrowUpRight,
  Megaphone,
  Package,
  Truck,
  BookOpen,
  Sparkles,
  Menu,
  MessageCircle,
  Bot,
  Target,
  Lightbulb,
  Brain
} from 'lucide-react'
import RabbitHead from './RabbitHead'
import { fetchHomePrompts } from '../lib/backend'

interface Props {
  onPick: (text: string) => void
  onToggleTools?: () => void
}

interface SkillCard {
  icon: typeof FileText
  title: string
  desc: string
  prompt: string
  iconBg: string
  iconColor: string
}

// 首页提示词图标注册表（icon 字段为 key，对应后端 Prompt.icon）
const PROMPT_ICON_MAP: Record<string, typeof FileText> = {
  megaphone: Megaphone,
  users: Users,
  search: Search,
  'graduation-cap': GraduationCap,
  'bar-chart-3': BarChart3,
  'trending-down': TrendingDown,
  package: Package,
  truck: Truck,
  'book-open': BookOpen,
  sparkles: Sparkles,
  'file-text': FileText,
  'message-circle': MessageCircle,
  bot: Bot,
  target: Target,
  lightbulb: Lightbulb,
  brain: Brain
}

// 各分类卡片配色（已知分类使用经理兔围巾颜色，未知分类使用默认样式）
const DEFAULT_CATEGORY_STYLE = { bg: 'bg-accent-soft', text: 'text-accent' }
const CATEGORY_STYLE: Record<string, { bg: string; text: string }> = {
  recommend: { bg: 'bg-accent-soft', text: 'text-accent' },
  platform: { bg: 'bg-accent-soft', text: 'text-accent' },
  marketing: { bg: 'bg-accent-soft', text: 'text-accent' },
  flow: { bg: 'bg-accent-soft', text: 'text-accent' },
  academic: { bg: 'bg-accent-soft', text: 'text-accent' },
  purchase: { bg: 'bg-accent-soft', text: 'text-accent' },
}

// 分类标签映射（已知分类用中文名，自定义分类直接显示英文 key）
const CATEGORY_LABEL_MAP: Record<string, string> = {
  recommend: '推荐',
  platform: '平台运营',
  marketing: '营销跟客',
  flow: '流向管控',
  purchase: '智能采购',
  academic: '学术培训',
  quick: '快采',
  collective: '集采',
  search: '找品',
}

export default function WelcomeScreen({ onPick, onToggleTools }: Props) {
  const [activeTab, setActiveTab] = useState<string>('recommend')
  // 后端首页提示词（按分类分组）
  const [backendCards, setBackendCards] = useState<Record<string, SkillCard[]> | null>(null)
  // 动态分类列表（来源：后端返回数据中出现的所有分类）
  const [categoryOrder, setCategoryOrder] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    fetchHomePrompts().then((data) => {
      if (cancelled || data === null) return
      const map: Record<string, SkillCard[]> = {}
      const seenCategories = new Set<string>()
      data.forEach((p) => {
        if (!p.category) return
        const cat = p.category
        seenCategories.add(cat)
        if (!map[cat]) map[cat] = []
        const style = CATEGORY_STYLE[cat] || DEFAULT_CATEGORY_STYLE
        map[cat].push({
          icon: PROMPT_ICON_MAP[p.icon] || FileText,
          title: p.title,
          desc: p.desc,
          prompt: p.prompt,
          iconBg: style.bg,
          iconColor: style.text
        })
      })
      // 生成有序的分类列表（按预定义顺序排前面，自定义分类排后面）
      const predefinedOrder = ['recommend', 'platform', 'marketing', 'flow', 'purchase', 'academic']
      const orderedCats = [
        ...predefinedOrder.filter((c) => seenCategories.has(c)),
        ...[...seenCategories].filter((c) => !predefinedOrder.includes(c)),
      ]
      setBackendCards(map)
      setCategoryOrder(orderedCats)
      // 如果当前 activeTab 不在有效分类中，切换到第一个
      if (orderedCats.length > 0 && !seenCategories.has(activeTab)) {
        setActiveTab(orderedCats[0])
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const cards = backendCards !== null && activeTab in backendCards
    ? backendCards[activeTab]
    : []

  // 生成动态 tabs（优先用映射标签，否则直接显示分类名）
  const tabs = categoryOrder.map((cat) => ({
    key: cat,
    label: CATEGORY_LABEL_MAP[cat] || cat,
  }))

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* 顶部工具栏展开按钮：首页固定显示，用于打开右侧边栏查看历史对话 */}
      {onToggleTools && (
        <div className="flex h-14 shrink-0 items-center justify-end px-6">
          <button
            onClick={onToggleTools}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
            title="展开右侧工具栏"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* 主内容区 */}
      <div className="flex-1 px-6 pb-6 pt-8">
        <div className="mx-auto max-w-3xl">
          {/* 头部问候：公仔与下方 tabs 左对齐，文字与公仔底部对齐 */}
          <div className="mb-8 flex items-end gap-4">
            <div className="h-20 w-20 shrink-0">
              <RabbitHead agentId="control" className="h-full w-full" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
                老板好！我是您的数字员工 <span className="text-text-primary">YesGo</span>
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-muted">
                我可以链接您的营销系统，通过AI数据分析，带团队为您策划并执行活动策划、跟客营销等事务
              </p>
            </div>
          </div>

          {/* Tab 标签 */}
          <div className="mb-6 flex items-center gap-6 border-b border-border-subtle">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative pb-3 text-sm font-medium transition-colors ${
                    isActive ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-text-primary" />
                  )}
                </button>
              )
            })}
          </div>

          {/* 卡片网格 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.length === 0 ? (
              <div className="col-span-full py-12 text-center text-sm text-text-muted">
                当前分类暂无可用提示词
              </div>
            ) : (
              cards.map(({ icon: Icon, title, desc, prompt, iconBg, iconColor }) => (
              <button
                key={`${activeTab}-${title}-${prompt.slice(0, 6)}`}
                onClick={() => onPick(prompt)}
                className="group relative flex h-[120px] flex-col rounded-2xl border border-border-subtle bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-border-default hover:shadow-md"
              >
                {/* 图标 + 标题（同排：图标在左，标题在右） */}
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
                    <Icon className={`h-[18px] w-[18px] ${iconColor}`} strokeWidth={2} />
                  </div>
                  <h3 className="flex-1 truncate text-sm font-semibold text-text-primary">{title}</h3>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
                {/* 描述 */}
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-muted">{desc}</p>
              </button>
            ))
          )}
          </div>
        </div>
      </div>
    </div>
  )
}

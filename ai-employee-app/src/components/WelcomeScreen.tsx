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
  Menu
} from 'lucide-react'
import RabbitHead from './RabbitHead'
import { fetchHomePrompts } from '../lib/backend'

interface Props {
  onPick: (text: string) => void
  onToggleTools?: () => void
}

type TabKey = 'recommend' | 'platform' | 'marketing' | 'flow' | 'purchase' | 'academic'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'recommend', label: '推荐' },
  { key: 'platform', label: '平台运营' },
  { key: 'marketing', label: '营销跟客' },
  { key: 'flow', label: '流向管控' },
  { key: 'purchase', label: '智能采购' },
  { key: 'academic', label: '学术培训' }
]

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
  'file-text': FileText
}

// 各分类卡片配色（与首页提示词 category 对应）
const CATEGORY_STYLE: Record<string, { bg: string; text: string }> = {
  recommend: { bg: 'bg-rose-50', text: 'text-rose-500' },
  platform: { bg: 'bg-emerald-50', text: 'text-emerald-500' },
  marketing: { bg: 'bg-indigo-50', text: 'text-indigo-500' },
  flow: { bg: 'bg-purple-50', text: 'text-purple-500' },
  purchase: { bg: 'bg-blue-50', text: 'text-blue-500' },
  academic: { bg: 'bg-amber-50', text: 'text-amber-500' }
}

const allCards: Record<TabKey, SkillCard[]> = {
  recommend: [
    {
      icon: Megaphone,
      title: '平台活动策划',
      desc: '根据近一个月平台运营及客户情况，根据不同客户策划平台促销活动...',
      prompt: '根据近一个月平台运营及客户情况，帮我策划平台促销活动',
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-500'
    },
    {
      icon: Users,
      title: '客户分析',
      desc: '分析前100名需要跟进的客户，附入表原因及跟进注意事项',
      prompt: '分析前100名需要跟进的客户，附入表原因及跟进注意事项',
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-500'
    },
    {
      icon: Search,
      title: '找控销产品',
      desc: '帮我找一个治疗风湿独家控销品种，我所在区域可以代理的，利润50...',
      prompt: '帮我找一个治疗风湿独家控销品种，我所在区域可以代理的，利润50%以上',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-500'
    },
    {
      icon: GraduationCap,
      title: '培训跟进',
      desc: '分析一下客户及业务员学术学习进度，以及学习后有没有进步',
      prompt: '分析一下客户及业务员学术学习进度，以及学习后有没有进步',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-500'
    },
    {
      icon: BarChart3,
      title: '经营分析',
      desc: '根据平台实际运营情况，你认为平台运营需要优化的点有那些？',
      prompt: '根据平台实际运营情况，你认为平台运营需要优化的点有哪些？',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-500'
    },
    {
      icon: TrendingDown,
      title: '滞销分析',
      desc: '分析一下库存量大、销量少存在滞销风险的前100个产品',
      prompt: '分析一下库存量大、销量少存在滞销风险的前100个产品',
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-500'
    }
  ],
  platform: [
    {
      icon: Megaphone,
      title: '平台活动策划',
      desc: '根据近一个月平台运营及客户情况，根据不同客户策划平台促销活动...',
      prompt: '根据近一个月平台运营及客户情况，帮我策划平台促销活动',
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-500'
    },
    {
      icon: BarChart3,
      title: '经营分析',
      desc: '根据平台实际运营情况，你认为平台运营需要优化的点有那些？',
      prompt: '根据平台实际运营情况，你认为平台运营需要优化的点有哪些？',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-500'
    }
  ],
  marketing: [
    {
      icon: Users,
      title: '客户分析',
      desc: '分析前100名需要跟进的客户，附入表原因及跟进注意事项',
      prompt: '分析前100名需要跟进的客户，附入表原因及跟进注意事项',
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-500'
    }
  ],
  flow: [
    {
      icon: TrendingDown,
      title: '滞销分析',
      desc: '分析一下库存量大、销量少存在滞销风险的前100个产品',
      prompt: '分析一下库存量大、销量少存在滞销风险的前100个产品',
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-500'
    }
  ],
  purchase: [
    {
      icon: Search,
      title: '找控销产品',
      desc: '帮我找一个治疗风湿独家控销品种，我所在区域可以代理的，利润50...',
      prompt: '帮我找一个治疗风湿独家控销品种，我所在区域可以代理的，利润50%以上',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-500'
    }
  ],
  academic: [
    {
      icon: GraduationCap,
      title: '培训跟进',
      desc: '分析一下客户及业务员学术学习进度，以及学习后有没有进步',
      prompt: '分析一下客户及业务员学术学习进度，以及学习后有没有进步',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-500'
    }
  ]
}

export default function WelcomeScreen({ onPick, onToggleTools }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('recommend')
  // 后端首页提示词（按分类分组）；为 null 时回退到静态 allCards
  const [backendCards, setBackendCards] = useState<Record<TabKey, SkillCard[]> | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchHomePrompts().then((data) => {
      if (cancelled || !data || data.length === 0) return
      const map: Record<TabKey, SkillCard[]> = {
        recommend: [], platform: [], marketing: [], flow: [], purchase: [], academic: []
      }
      data.forEach((p) => {
        const tab = (p.category in map ? p.category : 'recommend') as TabKey
        const style = CATEGORY_STYLE[p.category] || CATEGORY_STYLE.recommend
        map[tab].push({
          icon: PROMPT_ICON_MAP[p.icon] || FileText,
          title: p.title,
          desc: p.desc,
          prompt: p.prompt,
          iconBg: style.bg,
          iconColor: style.text
        })
      })
      setBackendCards(map)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const cards =
    backendCards && (backendCards[activeTab]?.length ?? 0) > 0
      ? backendCards[activeTab]
      : allCards[activeTab]

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
              <RabbitHead className="h-full w-full" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
                老板好！我是您的数字员工 <span className="text-text-primary">YesGo</span>
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-muted">
                我可以链接您的营销系统，通过AI数据分析，带团队为您策划并执行活动策划、智能采购、跟客营销等事务
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
            {cards.map(({ icon: Icon, title, desc, prompt, iconBg, iconColor }) => (
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
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

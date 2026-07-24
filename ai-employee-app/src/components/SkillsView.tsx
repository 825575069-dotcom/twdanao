import type { ReactNode } from 'react'
import {
  Sparkles,
  FileText,
  Mail,
  BarChart3,
  CalendarClock,
  Search,
  Plus,
  Check,
  ShoppingCart,
  MapPin,
  GraduationCap
} from 'lucide-react'
import { useStore } from '../store/appStore'
import { useTheme } from '../lib/theme'
import { toggleSkill as toggleSkillBackend } from '../lib/backend'

const catalog = [
  { icon: FileText, name: '客户报告生成', desc: '自动汇总客户动态，生成周报/月报', lightColor: 'text-indigo-500' },
  { icon: Mail, name: '商务邮件起草', desc: '按场景生成专业商务沟通邮件', lightColor: 'text-pink-500' },
  { icon: BarChart3, name: '销售数据分析', desc: '趋势分析、异常检测与归因', lightColor: 'text-amber-500' },
  { icon: CalendarClock, name: '跟进日程规划', desc: '智能排程与自动提醒', lightColor: 'text-cyan-500' },
  { icon: Search, name: '竞品监测', desc: '自动追踪竞品动态与价格变化', lightColor: 'text-emerald-500' },
  { icon: FileText, name: '合同审阅', desc: '识别条款风险并标注要点', lightColor: 'text-purple-500' },
  { icon: ShoppingCart, name: '智能补货', desc: '库存预警联动，生成三套采购方案', lightColor: 'text-rose-500' },
  { icon: MapPin, name: '窜货稽查', desc: '跨区域流向比对，异常自动预警', lightColor: 'text-orange-500' },
  { icon: GraduationCap, name: '学术素材生成', desc: '合规学术内容与患教素材生成', lightColor: 'text-violet-500' }
]

export default function SkillsView() {
  const store = useStore()
  const { mode } = useTheme()
  const isDark = mode === 'dark'

  const handleToggle = async (name: string) => {
    if (store.backendConnected) {
      await toggleSkillBackend(name)
    }
    store.toggleSkill(name)
  }

  const installed = catalog.filter((s) => store.installedSkills.includes(s.name))
  const market = catalog.filter((s) => !store.installedSkills.includes(s.name))

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageTitle
        icon={Sparkles}
        title="技能市场"
        desc="技能是数字员工的能力单元，可连接业务系统并提供专属工作流。安装后即挂载到对应智能体。"
      />

      <Section title={`已安装技能（${installed.length}）`}>
        {installed.length === 0 ? (
          <div className="rounded-xl border border-border-subtle bg-bg-surface/40 py-8 text-center text-sm text-text-muted">
            暂无已安装技能，从下方推荐中安装
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {installed.map((s) => (
              <SkillCard key={s.name} {...s} isDark={isDark} installed onToggle={() => handleToggle(s.name)} />
            ))}
          </div>
        )}
      </Section>

      <Section title="推荐技能">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {market.map((s) => (
            <SkillCard key={s.name} {...s} isDark={isDark} onToggle={() => handleToggle(s.name)} />
          ))}
        </div>
      </Section>
    </div>
  )
}

function SkillCard({
  icon: Icon,
  name,
  desc,
  lightColor,
  isDark,
  installed,
  onToggle
}: {
  icon: typeof Sparkles
  name: string
  desc: string
  lightColor: string
  isDark: boolean
  installed?: boolean
  onToggle?: () => void
}) {
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-border-subtle bg-bg-elevated p-4 transition-colors hover:border-border">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-surface">
        <Icon className={`h-4.5 w-4.5 ${isDark ? 'text-text-secondary' : lightColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text-primary">{name}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-text-muted">{desc}</div>
      </div>
      {installed ? (
        <button
          onClick={onToggle}
          className="flex items-center gap-1 rounded-full bg-bg-surface px-2 py-0.5 text-[11px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
          title="点击卸载"
        >
          <Check className="h-3 w-3" /> 已启用
        </button>
      ) : (
        <button
          onClick={onToggle}
          className="flex items-center gap-1 rounded-lg border border-border-subtle px-2 py-1 text-[11px] text-text-secondary transition-colors hover:border-accent hover:text-accent"
        >
          <Plus className="h-3 w-3" /> 安装
        </button>
      )}
    </div>
  )
}

export function PageTitle({
  icon: Icon,
  title,
  desc
}: {
  icon: typeof Sparkles
  title: string
  desc: string
}) {
  return (
    <div className="mb-8">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
        <Icon className="h-5 w-5 text-accent" />
      </div>
      <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm text-text-secondary">{desc}</p>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-8">
      <div className="mb-3 text-xs font-medium uppercase tracking-wider text-text-muted">{title}</div>
      {children}
    </div>
  )
}

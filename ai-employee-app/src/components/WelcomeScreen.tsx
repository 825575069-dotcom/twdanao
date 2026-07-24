import {
  FileText,
  Users,
  TrendingUp,
  Mail,
  CalendarClock,
  Sparkles,
  ArrowRight
} from 'lucide-react'
import { useTheme } from '../lib/theme'

interface Props {
  onPick: (text: string) => void
}

const skills = [
  {
    icon: FileText,
    title: '生成客户报告',
    desc: '汇总本周客户动态与跟进情况',
    prompt: '帮我生成本周客户跟进报告',
    lightColor: 'from-indigo-500/20 to-indigo-500/5',
    lightIconColor: 'text-indigo-500'
  },
  {
    icon: Users,
    title: '查询客户档案',
    desc: '从 B2B 系统调取客户信息与订单',
    prompt: '查询客户「示例公司」的档案',
    lightColor: 'from-emerald-500/20 to-emerald-500/5',
    lightIconColor: 'text-emerald-500'
  },
  {
    icon: TrendingUp,
    title: '销售数据分析',
    desc: '分析近期销售趋势与异常波动',
    prompt: '分析近 30 天销售数据趋势',
    lightColor: 'from-amber-500/20 to-amber-500/5',
    lightIconColor: 'text-amber-500'
  },
  {
    icon: Mail,
    title: '起草商务邮件',
    desc: '根据场景生成专业商务沟通邮件',
    prompt: '帮我起草一封跟进客户的商务邮件',
    lightColor: 'from-pink-500/20 to-pink-500/5',
    lightIconColor: 'text-pink-500'
  },
  {
    icon: CalendarClock,
    title: '安排跟进计划',
    desc: '自动规划客户跟进日程与提醒',
    prompt: '帮我安排下周的客户跟进计划',
    lightColor: 'from-cyan-500/20 to-cyan-500/5',
    lightIconColor: 'text-cyan-500'
  },
  {
    icon: Sparkles,
    title: '更多技能',
    desc: '探索技能市场，接入你的业务系统',
    prompt: '打开技能市场',
    lightColor: 'from-purple-500/20 to-purple-500/5',
    lightIconColor: 'text-purple-500'
  }
]

export default function WelcomeScreen({ onPick }: Props) {
  const { mode } = useTheme()
  const isDark = mode === 'dark'

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col items-center justify-center px-6 py-12">
      {/* 问候 */}
      <div className="animate-slide-up mb-3 flex items-center gap-2 rounded-full border border-border-subtle bg-bg-elevated px-4 py-1.5 text-xs text-text-secondary">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
        数字员工已就绪
      </div>

      <h2 className="animate-slide-up text-center text-3xl font-semibold tracking-tight text-text-primary">
        你好，我是你的{' '}
        <span className={isDark ? 'text-text-primary' : 'bg-gradient-to-r from-accent to-purple-400 bg-clip-text text-transparent'}>
          AI 数字员工
        </span>
      </h2>
      <p className="animate-slide-up mt-3 max-w-xl text-center text-sm leading-relaxed text-text-secondary">
        我可以连接你的 B2B 业务系统，帮你处理客户、订单、数据与日常事务。
        从下方选择一个技能开始，或在输入框直接下达指令。
      </p>

      {/* 技能卡片 */}
      <div className="mt-10 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {skills.map(({ icon: Icon, title, desc, prompt, lightColor, lightIconColor }) => (
          <button
            key={title}
            onClick={() => onPick(prompt)}
            className={`group relative overflow-hidden rounded-xl border border-border-subtle p-4 text-left transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-card ${
              isDark
                ? 'bg-bg-elevated'
                : `bg-gradient-to-br ${lightColor}`
            }`}
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-bg-elevated/80">
              <Icon className={`h-4.5 w-4.5 ${isDark ? 'text-text-secondary' : lightIconColor}`} strokeWidth={2} />
            </div>
            <div className="text-sm font-medium text-text-primary">{title}</div>
            <div className="mt-1 text-xs leading-relaxed text-text-muted">
              {desc}
            </div>
            <ArrowRight className="absolute right-3 top-3 h-3.5 w-3.5 text-text-muted opacity-0 transition-all group-hover:right-2.5 group-hover:opacity-100" />
          </button>
        ))}
      </div>

      <div className="mt-8 text-xs text-text-muted">
        提示：按 <kbd className="rounded border border-border-subtle px-1.5 py-0.5">⌘K</kbd>{' '}
        打开命令面板
      </div>
    </div>
  )
}

// 本地轻量摘要组件 — 需求文档第 6.2 章
// 仅「客户自治闭环模式」下生效（脱离天网大脑，直连客户自有大模型）
// 能力边界：
//   1. 仅支持单轮对话关键词提取、简短摘要
//   2. 无每日批量汇总、记忆时效管控、Token 容量自动淘汰（需天网大脑 memory_engine 支持）
//   3. 摘要持久化至 localStorage，无法和统一智能体工作流联动

import type { MemorySummary, RetentionMonths } from '../types'

const STORAGE_KEY = 'yesgo_local_memory_summaries'

// —— 关键词提取（基于本地规则，不依赖大模型） ——
const KEYWORDS_BANK = [
  // 采购
  '补货', '采购', '供应商', '比价', '报价', '库存', '缺货', '订单', '进货价',
  // 客户
  '客户', '拜访', '跟进', '回款', '账期', '信用', '欠款',
  // 药品
  '阿莫西林', '头孢', '布洛芬', '抗生素', '慢病', '处方药', 'OTC', '中成药',
  // 经营
  '销量', '毛利', '库存周转', '促销', '滞销', '窜货', '渠道',
  // 学术
  '患教', '合规', '学术', '推广', 'DM', '科室会',
  // 状态
  '紧急', '待处理', '已完成', '延迟', '异常'
]

export function extractKeywords(text: string): string[] {
  const matched = new Set<string>()
  const lower = text.toLowerCase()
  for (const kw of KEYWORDS_BANK) {
    if (lower.includes(kw.toLowerCase())) {
      matched.add(kw)
    }
  }
  return Array.from(matched).slice(0, 8)
}

// —— 简短摘要生成（基于规则模板） ——
export function generateBriefSummary(
  messages: Array<{ role: string; content: string }>
): Pick<MemorySummary, 'keywords' | 'summary' | 'messageCount' | 'estimatedTokens'> {
  const allText = messages.map((m) => m.content).join('\n')
  const keywords = extractKeywords(allText)
  const messageCount = messages.length

  // 估算 Token（中文约 1.5 字符/Token）
  const estimatedTokens = Math.ceil(allText.length / 1.5)

  // 生成模板化摘要
  const userMessages = messages.filter((m) => m.role === 'user')
  const firstUserMsg = userMessages[0]?.content?.slice(0, 40) || '对话'

  let summary = ''
  if (keywords.length >= 3) {
    summary = `${firstUserMsg}… 涉及 ${keywords.slice(0, 3).join('、')}`
  } else if (keywords.length > 0) {
    summary = `${firstUserMsg}… 涉及 ${keywords[0]}`
  } else {
    summary = `${firstUserMsg}…`
  }

  return { keywords, summary, messageCount, estimatedTokens }
}

// —— localStorage 持久化 ——

export function getStoredSummaries(): MemorySummary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as MemorySummary[]
  } catch {
    return []
  }
}

export function storeSummary(
  messages: Array<{ role: string; content: string }>
): MemorySummary {
  const { keywords, summary, messageCount, estimatedTokens } = generateBriefSummary(messages)
  const entry: MemorySummary = {
    id: `mem_${Date.now()}`,
    date: new Date().toLocaleDateString('zh-CN'),
    keywords,
    summary,
    messageCount,
    estimatedTokens,
    createdAt: new Date().toISOString()
  }

  const existing = getStoredSummaries()
  existing.unshift(entry)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
  } catch {
    // localStorage 满，移除最旧的
    existing.pop()
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
    } catch {
      // 静默失败
    }
  }

  return entry
}

// —— 过期清理 ——

export function clearExpiredSummaries(retentionMonths: RetentionMonths): void {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - retentionMonths)
  const cutoffTime = cutoff.getTime()

  const existing = getStoredSummaries()
  const valid = existing.filter((s) => {
    const created = new Date(s.createdAt).getTime()
    return created >= cutoffTime
  })

  if (valid.length !== existing.length) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid))
    } catch {
      // 静默失败
    }
  }
}

// —— Token 容量淘汰（LRU：最新在前，移除尾部） ——

export function removeOldestSummaries(maxTokens: number): void {
  const existing = getStoredSummaries()
  let totalTokens = existing.reduce((sum, s) => sum + s.estimatedTokens, 0)

  if (totalTokens <= maxTokens) return

  // 从尾部（最旧）开始移除
  const kept = [...existing]
  while (totalTokens > maxTokens && kept.length > 0) {
    const removed = kept.pop()!
    totalTokens -= removed.estimatedTokens
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(kept))
  } catch {
    // 静默失败
  }
}

// —— 综合清理（时效 + 容量） ——

export function runMemoryMaintenance(retentionMonths: RetentionMonths, tokenCap: number): void {
  clearExpiredSummaries(retentionMonths)
  removeOldestSummaries(tokenCap)
}

// —— 统计 ——

export function getMemoryStats() {
  const summaries = getStoredSummaries()
  const totalTokens = summaries.reduce((sum, s) => sum + s.estimatedTokens, 0)
  return {
    count: summaries.length,
    totalTokens,
    oldestDate: summaries[summaries.length - 1]?.date || '无',
    newestDate: summaries[0]?.date || '无'
  }
}

// —— 清空全部记忆 ——

export function clearAllMemories(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 静默失败
  }
}

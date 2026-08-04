// ============================================================
// 权限工具 —— ���图权限映射与检查（桌面端 App 闭环）
// ============================================================
import type { ViewKey } from '../App'

/** 视图 → 权限码映射表（对齐后端 TENANT_PERMISSION_CATALOG） */
export const VIEW_PERMISSION_MAP: Record<ViewKey, string> = {
  chat: 'tenant.chat.view',
  tasks: 'tenant.tasks.view',
  office: 'tenant.office.view',
  marketing: 'tenant.agent.crm',
  pharmacyPurchase: 'tenant.agent.purchase',
  knowledge: 'tenant.knowledge.view',
  dataBase: 'tenant.dataBase.view',
  media: 'tenant.media.view',
  skills: 'tenant.skills.view',
  data: 'tenant.data.view',
  clients: 'tenant.clients.view',
  permissions: 'tenant.permissions.view',
  credits: 'tenant.credits.view',
  models: 'tenant.models.view',
  config: 'tenant.config.view',
  security: 'tenant.security.view',
  settings: 'tenant.settings.view',
  manualIntervention: 'tenant.manualIntervention.view',
  notificationTargets: 'tenant.notificationTargets.view',
} as const

/** 判断用户是否拥有访问某个视图的权限 */
export function hasAccess(userPermissions: string[], viewKey: ViewKey): boolean {
  // 超级管理员通配符 → 全部放行
  if (userPermissions.includes('*')) return true
  const permCode = VIEW_PERMISSION_MAP[viewKey]
  if (!permCode) return true // 未知视图默认放行
  return userPermissions.includes(permCode)
}

/** 智能体 code → 权限码 */
export const AGENT_PERMISSION_MAP: Record<string, string> = {
  ops: 'tenant.agent.ops',
  crm: 'tenant.agent.crm',
  purchase: 'tenant.agent.purchase',
  flow: 'tenant.agent.flow',
  academic: 'tenant.agent.academic',
} as const

/** 判断用户是否有权使用某个智能体 */
export function canUseAgent(userPermissions: string[], agentCode: string): boolean {
  if (userPermissions.includes('*')) return true
  const permCode = AGENT_PERMISSION_MAP[agentCode]
  return permCode ? userPermissions.includes(permCode) : true
}

// ============================================================
// 权限工具 —— ���图权限映射与检查（桌面端 App 闭环）
// ============================================================
import type { ViewKey } from '../App'

/** 视图 → 权限码映射表（对齐后端 PERMISSION_CATALOG） */
export const VIEW_PERMISSION_MAP: Record<ViewKey, string> = {
  chat: 'chat.view',
  tasks: 'tasks.view',
  office: 'office.view',
  marketing: 'agent.crm',
  knowledge: 'knowledge.view',
  dataBase: 'dataBase.view',
  media: 'media.view',
  skills: 'skills.view',
  data: 'data.view',
  clients: 'clients.view',
  permissions: 'permissions.view',
  credits: 'credits.view',
  models: 'models.view',
  config: 'config.view',
  security: 'security.view',
  settings: 'settings.view',
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
  ops: 'agent.ops',
  crm: 'agent.crm',
  purchase: 'agent.purchase',
  flow: 'agent.flow',
  academic: 'agent.academic',
} as const

/** 判断用户是否有权使用某个智能体 */
export function canUseAgent(userPermissions: string[], agentCode: string): boolean {
  if (userPermissions.includes('*')) return true
  const permCode = AGENT_PERMISSION_MAP[agentCode]
  return permCode ? userPermissions.includes(permCode) : true
}

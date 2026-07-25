// ============================================================
// YesGo Admin Dashboard — Types
// ============================================================

export interface ApiResponse<T = unknown> {
  code: number;
  msg: string;
  data: T;
}

// Auth
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: UserInfo;
  tenant: TenantInfo;
}

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  is_superuser: boolean;
}

// Tenant
export interface TenantInfo {
  id: number;
  code: string;
  name: string;
  platform_name: string;
  status: 'active' | 'inactive' | 'pending';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TenantMember {
  id: number;
  username: string;
  email: string;
  role_name: string;
  role_code: string;
  credits: number;
  status: 'online' | 'offline';
  enabled: boolean;
}

export interface TenantRole {
  id: number;
  name: string;
  code: string;
  description: string;
  can_manage_members: boolean;
  can_assign_credits: boolean;
  agents: string[];
  views: string[];
}

export interface TenantPackage {
  id: number;
  name: string;
  quotas: PackageQuota[];
}

export interface PackageQuota {
  id: number;
  agent_code: string;
  monthly: number;
  used: number;
}

// Model Gateway
export interface AIModel {
  id: number;
  name: string;
  vendor: string;
  type: 'commercial' | 'open';
  context_k: number;
  status: 'ready' | 'deploying' | 'offline';
  description: string;
  api_key: string;
  endpoint: string;
  config: Record<string, unknown>;
  created_at: string;
}

export interface ModelKey {
  id: number;
  model_id: number;
  key_alias: string;
  api_key: string;
  endpoint: string;
  status: 'active' | 'disabled' | 'exhausted' | 'error';
  priority: number;
  daily_quota: number;
  daily_used: number;
  total_used: number;
  last_used: string | null;
  last_error: string | null;
  error_count: number;
}

export interface TokenUsageStats {
  total_tokens: number;
  total_cost: number;
  by_model: { model_name: string; tokens: number; cost: number }[];
  by_agent: { agent_code: string; tokens: number; cost: number }[];
  trend: { date: string; tokens: number }[];
}

export interface RoutingStrategy {
  id: number;
  name: string;
  agent_code: string;
  primary_model_name: string;
  fallback_model_name: string;
  strategy_type: string;
  enabled: boolean;
}

export interface CircuitBreakerState {
  id: number;
  model_name: string;
  state: 'closed' | 'open' | 'half_open';
  failure_count: number;
  failure_threshold: number;
  last_failure: string | null;
}

// Agent
export interface AgentDefinition {
  code: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  model_id: string;
  temperature: number;
  max_retry: number;
  fallback_model_id: string;
  human_takeover_threshold: number;
  custom: Record<string, unknown>;
}

export interface AgentConfigItem {
  id: number;
  agent_id: string;
  model_id: string;
  temperature: number;
  max_retry: number;
  fallback_model_id: string;
  human_takeover_threshold: number;
  custom: Record<string, unknown>;
}

// Database / Connectors
export interface DataConnector {
  id: number;
  name: string;
  type: 'erp' | 'b2b' | 'b2c' | 'third-party';
  description: string;
  icon_name: string;
  enabled: boolean;
  status: string;
  config: Record<string, unknown>;
  last_sync: string | null;
}

export interface DatabaseRecord {
  id: number;
  name: string;
  type: string;
  host: string;
  port: number;
  status: string;
  size: string;
  tables_count: number;
  created_at: string;
}

// Knowledge / Workflows
export interface KnowledgeDoc {
  id: number;
  name: string;
  type: string;
  size: string;
  folder: string;
  bound_agents: string[];
  created_at: string;
}

export interface Prompt {
  id: number;
  name: string;
  content: string;
  agent_code: string | null;
  category: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTemplate {
  id: number;
  name: string;
  description: string;
  agent_code: string;
  steps: WorkflowStep[];
  enabled: boolean;
}

export interface WorkflowStep {
  order: number;
  name: string;
  type: string;
  config: Record<string, unknown>;
}

// Dify
export interface DifyConfig {
  id: number;
  configured: boolean;
  connection_status: string;
  last_test: string | null;
  error: string | null;
  workflows: DifyWorkflow[];
}

export interface DifyWorkflow {
  id: number;
  code: string;
  agent_code: string;
  api_key: string;
  base_url: string;
}

// Dashboard
export interface DashboardOverview {
  revenue: { total: number; growth: number };
  orders: { total: number; growth: number };
  customers: { total: number; active: number };
  inventory: { total: number; alerts: number };
  agents: { total: number; active: number };
}

export interface DashboardKPI {
  name: string;
  target: number;
  current: number;
  unit: string;
}

export interface DashboardAlert {
  id: number;
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  time: string;
}

// Security
export interface AuditLog {
  id: number;
  user_name: string;
  action: string;
  resource_type: string;
  description: string;
  method: string;
  path: string;
  ip_address: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
}

export interface SecurityEvent {
  id: number;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  user_name: string;
  ip_address: string;
  resolved: boolean;
  created_at: string;
}

export interface SecurityOverview {
  total_audit_logs: number;
  total_events: number;
  unresolved_events: number;
  critical_events: number;
  audit_trend: { date: string; count: number }[];
  events_by_type: { type: string; count: number }[];
}

// System Health
export interface SystemHealth {
  service: string;
  status: string;
  version: string;
  layer: string;
  database: string;
  redis: string;
  uptime: string;
}

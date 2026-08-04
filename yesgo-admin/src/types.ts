// ============================================================
// YesGo Admin Dashboard — Types
// ============================================================

export interface ApiResponse<T = unknown> {
  code: number;
  msg: string;
  data: T;
}

// 可销区域
export interface SalesRegion {
  province: string;
  cities?: string[];
}

// 提示词（首页提示词 / 普通提示词 / 采购对话提示词 / 采购兔首页提示词）
export interface PromptItem {
  id: number;
  prompt_type: 'home' | 'chat' | 'purchase_chat' | 'purchase_home';
  category: string;
  title: string;
  icon: string;
  content: string;
  enabled: boolean;
  sort: number;
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
  id: number | string;
  username?: string;
  name?: string;
  email?: string;
  is_superuser?: boolean;
  roleId?: string;
  roleName?: string;
  permissions: string[];
}

// Tenant
export interface TenantInfo {
  id: number;
  code: string;
  name: string;
  platform_name: string;
  enterprise_id?: string;
  status: 'active' | 'inactive' | 'pending';
  province?: string;
  city?: string;
  address?: string;
  channel?: string;
  channel_display?: string;
  credits?: number;
  member_count?: number;
  agent_count?: number;
  agent_codes?: string[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TenantCreditRecord {
  id: number;
  user_name: string;
  agent_code: string;
  agent_name: string;
  amount: number;
  reason: string;
  balance_after: number;
  created_at: string;
}

export interface TenantCreditsData {
  balance: number;
  ledger: TenantCreditRecord[];
}

export interface TenantAgentBinding {
  id?: number;
  name: string;
  type: string;
  description?: string;
  api_url?: string;
  api_key?: string;
}

export interface TenantAgentsData {
  assigned: string[];
  available: AgentInfo[];
  bindings?: Record<string, TenantAgentBinding[]>;
}

export interface TenantMember {
  id: number;
  username: string;
  name: string;
  email: string;
  phone: string;
  role_name: string;
  role_code: string;
  credits: number;
  status: 'online' | 'offline';
  enabled: boolean;
  created_at: string;
}

export interface TenantRole {
  id: number;
  name: string;
  code: string;
  description: string;
  permissions: string[];
  can_manage_members: boolean;
  can_assign_credits: boolean;
  agents: string[];
  views: string[];
}

export interface PermissionItem {
  code: string;
  name: string;
  category: string;
}

// 平台权限（第二层）
export interface PlatformRole {
  id: number;
  name: string;
  code: string;
  description: string;
  permissions: string[];
}

export interface PlatformStaff {
  id: number;
  username: string;
  name: string;
  email: string;
  phone: string;
  role_id: number;
  role_name: string;
  enabled: boolean;
  created_at: string;
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

export interface AgentInfo {
  id: number;
  agent_id: string;
  code: string;
  name: string;
  role: string;
  emoji: string;
  scarf_color: string;
  avatar?: string;
  accent: string;
  description: string;
  capabilities: string[];
  stats: Record<string, unknown>;
  default_workflow: WorkflowStep[];
  sort_order: number;
  enabled: boolean;
  capability_mode?: string;
  external_workflow_code?: string;
  external_workflow_code_display?: string;
  default_workflow_template_id?: number | null;
  default_workflow_template_name?: string | null;
  tenant_count?: number;
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
  custom_name?: string;
  custom_role?: string;
  custom_description?: string;
  custom_workflow?: WorkflowStep[];
  custom_scarf_color?: string;
  custom_avatar?: string;
  bound_data_bases?: number[];
  bound_docs?: number[];
  bound_images?: number[];
  custom_workflow_template_id?: number | null;
  custom_workflow_template_name?: string | null;
}

// Media Asset (营销素材)
export interface MediaAsset {
  id: number;
  name: string;
  type: string;
  size: string;
  file?: string | null;
  file_url?: string;
  url?: string;
  folder?: string;
  description?: string;
  bound_agents?: number[];
  created_at: string;
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

// Platform Database (SaaS 平台配置)
export interface PlatformDatabase {
  id: number;
  code: string;
  name: string;
  type: 'erp' | 'b2b' | 'b2c' | 'third_party';
  type_display?: string;
  description: string;
  icon_name: string;
  api_base_url: string;
  api_token: string;
  sync_enabled: boolean;
  last_synced_at: string | null;
  last_sync_status: string;
  last_sync_error: string;
  total_enterprises: number;
  linked_tenant_count: number;
  enterprise_count?: number;
  enterprises?: PlatformEnterprise[];
  enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Platform Enterprise (同步缓存 — 从 SaaS 平台同步的企业)
export interface PlatformEnterprise {
  id: number;
  platform_database: number;
  platform_database_name?: string;
  enterprise_id: string;
  enterprise_name: string;
  db_type: 'mysql' | 'api';
  db_type_display?: string;
  db_config: Record<string, unknown>;
  matched_tenant: number | null;
  matched_tenant_name?: string;
  matched_tenant_code?: string;
  last_synced_at: string;
}

// ========== 公共数据库 ==========
export interface PdbSupplier {
  id: number;
  name: string;
  code: string;
  supplier_type: 'saas_platform' | 'independent';
  supplier_type_display?: string;
  enterprise_id: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  address: string;
  payment_account_id: string;
  api_base_url: string;
  api_token: string;
  sync_enabled: boolean;
  last_synced_at: string | null;
  qualification_status: 'pending' | 'approved' | 'rejected';
  qualification_status_display?: string;
  qualification_verified_at: string | null;
  qualification_remark: string;
  enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  qualifications?: PdbSupplierQualification[];
  commission_protocols?: PdbCommissionProtocol[];
  product_count?: number;
  active_protocol?: PdbCommissionProtocol | null;
}

export interface PdbSupplierQualification {
  id: number;
  supplier: number;
  qualification_type: string;
  qualification_type_display?: string;
  qualification_name: string;
  file_url: string;
  file_name: string;
  license_number: string;
  expiry_date: string | null;
  verified: boolean;
  created_at: string;
}

export interface PdbCommissionProtocol {
  id: number;
  supplier: number;
  supplier_name?: string;
  protocol_type: 'percentage' | 'fixed';
  protocol_type_display?: string;
  value: string;
  min_commission: string;
  effective_from: string;
  effective_until: string | null;
  status: 'active' | 'expired' | 'terminated';
  status_display?: string;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PdbProduct {
  id: number;
  supplier: number;
  supplier_id?: number;
  supplier_name?: string;
  product_code: string;
  name: string;
  trade_name: string;
  specification: string;
  manufacturer: string;
  dosage_form: string;
  unit: string;
  price: string;
  min_order_quantity: number;
  category: string;
  approval_number: string;
  barcode: string;
  knowledge_graph: string;
  manual_url: string;
  manual_text: string;
  delivery_info: string;
  storage_condition: string;
  delivery_areas: string;
  sales_regions: SalesRegion[];
  sales_channels: string[];
  status: 'active' | 'inactive' | 'out_of_stock';
  status_display?: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  supplier_info?: {
    id: number;
    name: string;
    code: string;
    enterprise_id: string;
    qualification_status: string;
    qualification_status_display: string;
    contact_name: string;
    contact_phone: string;
    address: string;
    qualifications: PdbSupplierQualification[];
  };
}

export interface PdbCollectiveBatch {
  id: number;
  batch_date: string;
  product: number;
  product_name?: string;
  product_spec?: string;
  supplier: number;
  supplier_name?: string;
  status: 'collecting' | 'notifying_supplier' | 'quoted' | 'distributed' | 'closed';
  status_display?: string;
  total_quantity: number;
  quoted_price: string | null;
  quoted_at: string | null;
  expires_at: string | null;
  notify_method: 'api' | 'third_layer';
  notify_method_display?: string;
  notes: string;
  quote_count?: number;
  created_at: string;
  updated_at: string;
}

export interface PdbQuote {
  id: number;
  quote_type: 'quick' | 'collective';
  quote_type_display?: string;
  tenant: number;
  tenant_name?: string;
  product: number;
  product_name?: string;
  product_spec?: string;
  product_manufacturer?: string;
  supplier: number;
  supplier_name?: string;
  collective_batch: number | null;
  agent_id: string;
  quantity: number;
  unit_price: string | null;
  total_price: string | null;
  status: 'pending' | 'quoted' | 'accepted' | 'rejected' | 'expired' | 'ordered';
  status_display?: string;
  notes: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PdbOrder {
  id: number;
  order_number: string;
  tenant: number;
  tenant_name?: string;
  supplier: number;
  supplier_name?: string;
  quote: number | null;
  order_type: 'quick' | 'collective';
  order_type_display?: string;
  status: string;
  status_display?: string;
  total_amount: string;
  commission_amount: string;
  supplier_amount: string;
  payment_method: string;
  payment_method_display?: string;
  payment_status: string;
  payment_status_display?: string;
  supplier_order_id: string;
  supplier_order_synced: boolean;
  qualification_exchange_status: string;
  e_signature_status: string;
  e_signature_contract_id: string;
  notes: string;
  items: PdbOrderItem[];
  created_at: string;
  updated_at: string;
}

export interface PdbOrderItem {
  id: number;
  order: number;
  product: number | null;
  product_name: string;
  product_spec: string;
  product_manufacturer: string;
  product_unit: string;
  quantity: number;
  unit_price: string;
  total_price: string;
}

export interface PdbPaymentRecord {
  id: number;
  order: number;
  order_number?: string;
  payment_method: string;
  payment_method_display?: string;
  amount: string;
  commission_amount: string;
  supplier_amount: string;
  status: string;
  status_display?: string;
  channel: string;
  channel_transaction_id: string;
  channel_split_id: string;
  paid_at: string | null;
  split_at: string | null;
  error_message: string;
  created_at: string;
  updated_at: string;
}

// 集采公告
export interface CollectiveAnnouncement {
  id: number;
  title: string;
  description: string;
  announce_time: string;
  quote_deadline: string;
  order_deadline: string;
  status: 'draft' | 'announced' | 'collecting' | 'quoting' | 'distributed' | 'ordering' | 'closed' | 'cancelled';
  status_display?: string;
  product_keywords: string;
  supplier_ids: string;
  created_by: number | null;
  notes: string;
  participation_count?: number;
  total_quantity?: number;
  created_at: string;
  updated_at: string;
  participations?: CollectiveParticipation[];
}

export interface CollectiveParticipation {
  id: number;
  announcement: number;
  tenant: number;
  tenant_name?: string;
  product: number;
  product_name?: string;
  supplier: number;
  supplier_name?: string;
  registered_quantity: number;
  quoted_unit_price: string | null;
  adjusted_quantity: number | null;
  status: 'registered' | 'quoted' | 'adjusted' | 'ordered' | 'declined';
  status_display?: string;
  created_at: string;
  updated_at: string;
}

export interface AggregateItem {
  product_id: number;
  product_name: string;
  supplier_id: number;
  supplier_name: string;
  total_quantity: number;
  tenant_count: number;
  stock_quantity: number | null;
}

// 供应商账号
export interface SupplierAccount {
  id: number;
  supplier: number;
  supplier_name: string;
  username: string;
  contact_name: string;
  contact_phone: string;
  api_token: string;
  enabled: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

// 供应商配送规则
export interface SupplierDeliveryRule {
  id: number;
  supplier: number;
  supplier_name?: string;
  province: string;
  city: string;
  delivery_hours: number;
  min_order_amount: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Knowledge / Workflows
export interface KnowledgeDoc {
  id: number;
  name: string;
  type: string;
  size: string;
  folder: string;
  bound_agents: string[];
  content_text?: string;
  created_at: string;
}

export interface AgentRole {
  id: number;
  name: string;
  code: string;
  category: string;
  description: string;
  agent_id: number | null;
  agent_code: string | null;
  agent_name: string | null;
  enabled: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTemplate {
  id: number;
  name: string;
  description: string;
  category: string;
  tags: string[];
  steps: WorkflowStep[];
  edges: WorkflowEdge[];
  enabled: boolean;
  sort_order: number;
}

export interface WorkflowStep {
  id: string;
  order: number;
  name: string;
  type: 'trigger' | 'action' | 'condition' | 'end';
  config: string | Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  type?: 'serial' | 'parallel';
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
  tenants: { total: number; active: number };
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

// ========== 企微管理 ==========
export interface WecomGlobalConfig {
  id: number;
  sdk_url: string;
  sdk_token: string;
  callback_token: string;
  updated_at: string;
}

export interface WecomAreaCode {
  code: string;
  name: string;
}

export interface WecomNumber {
  id: number;
  guid: string;
  tenant: number | null;
  tenant_name: string;
  province_code: string;
  province_name: string;
  remark: string;
  device_name: string;
  device_type: number;
  proxy_url: string;
  client_version: string;
  expires_at: string | null;
  price: string;
  status: string;
  status_display: string;
  bound_device: number | null;
  bound_device_name: string;
  created_at: string;
  updated_at: string;
}

// ========== 积分管理 ==========
export interface CreditConfig {
  id: number;
  tokens_per_credit: number;
  unit_price: string;
  free_credits_on_register: number;
  min_purchase_credits: number;
  enable_online_pay: boolean;
  enable_offline_pay: boolean;
  updated_at: string;
}

export interface CreditPackage {
  id: number;
  name: string;
  credits: number;
  price: string;
  bonus_credits: number;
  is_popular: boolean;
  enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AgentCreditRule {
  id: number;
  agent_code: string;
  agent_name: string;
  coefficient: number;
  free_deduction: boolean;
  description: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreditOrder {
  id: number;
  order_no: string;
  tenant: number;
  tenant_name: string;
  tenant_code: string;
  package: number | null;
  package_name: string;
  credits: number;
  bonus_credits: number;
  total_credits: number;
  amount: string;
  payment_method: string;
  payment_method_display: string;
  status: string;
  status_display: string;
  proof_file: string;
  remark: string;
  confirmed_by: number | null;
  confirmed_by_name: string;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditOrderListResponse {
  items: CreditOrder[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreditStats {
  total_revenue: string;
  total_credits_sold: number;
  total_orders: number;
  pending_orders: number;
  tenant_balances: Array<{
    id: number;
    name: string;
    code: string;
    credits: number;
  }>;
  recent_orders: Array<{
    created_at: string;
    credits: number;
    amount: string;
    status: string;
  }>;
  agent_consumption: Array<{
    agent_code: string;
    agent_name: string;
    total_consumed: number;
    count: number;
  }>;
}

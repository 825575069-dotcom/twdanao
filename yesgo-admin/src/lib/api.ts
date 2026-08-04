// ============================================================
// YesGo Admin — API Client
// ============================================================
import type { ApiResponse } from '@/types';

const DEFAULT_BASE_URL = import.meta.env.PROD
  ? 'https://twdanaob.88yldh.com/api/v1'
  : 'http://localhost:8000/api/v1';

class AdminApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = localStorage.getItem('yesgo_admin_api_url') || DEFAULT_BASE_URL;
    this.token = localStorage.getItem('yesgo_admin_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('yesgo_admin_token', token);
    } else {
      localStorage.removeItem('yesgo_admin_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private normalizePath(path: string): string {
    if (path.includes('?')) {
      const [base, query] = path.split('?', 2);
      const normalizedBase = base.endsWith('/') ? base : base + '/';
      return `${normalizedBase}?${query}`;
    }
    return path.endsWith('/') ? path : path + '/';
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    tenantId?: string,
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    const res = await fetch(`${this.baseUrl}${this.normalizePath(path)}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      this.setToken(null);
      window.location.href = '/admin/';
      // 跳转到登录页，避免调用方继续处理并显示原始错误信息
      return new Promise<ApiResponse<T>>(() => {});
    }

    const data: ApiResponse<T> = await res.json();
    if (data.code !== 0) {
      throw new Error(data.msg || '请求失败');
    }
    return data;
  }

  // Auth
  async login(username: string, password: string) {
    const res = await this.request<{
      access_token: string;
      refresh_token: string;
      user: { id: string; name: string; roleId: string; roleName: string; permissions: string[] };
      tenant: { id: number; code: string; name: string; status: string };
    }>('POST', '/auth/login', { username, password });
    if (res.data.access_token) {
      this.setToken(res.data.access_token);
    }
    return res;
  }

  async me() {
    return this.request<{
      user: { id: string; name: string; roleId: string; roleName: string; permissions: string[] };
      tenant: import('@/types').TenantInfo;
    }>('GET', '/auth/me');
  }

  async logout() {
    return this.request('POST', '/auth/logout');
  }

  async forgotPasswordSendCode(phone: string) {
    return this.request<{ phone: string; code?: string; expires_in: number }>(
      'POST', '/auth/forgot-password/send-code', { phone }
    );
  }

  async forgotPasswordVerifyCode(phone: string, code: string) {
    return this.request<{ phone: string; reset_token: string; expires_in: number }>(
      'POST', '/auth/forgot-password/verify-code', { phone, code }
    );
  }

  async forgotPasswordReset(phone: string, resetToken: string, newPassword: string) {
    return this.request<{ msg: string }>(
      'POST', '/auth/forgot-password/reset', { phone, reset_token: resetToken, new_password: newPassword }
    );
  }

  // Health
  async health() {
    return this.request<{
      service: string; status: string; version: string; layer: string;
      database: string; redis: string; uptime: string;
    }>('GET', '/health/');
  }

  // Tenants
  async getTenants() {
    return this.request<{ tenants: import('@/types').TenantInfo[] }>('GET', '/platform/tenants');
  }

  async getTenantInfo(tenantId: string) {
    return this.request<import('@/types').TenantInfo>('GET', '/tenant/info', undefined, tenantId);
  }

  async getTenantMembers(tenantId: string) {
    return this.request<import('@/types').TenantMember[]>('GET', '/tenant/members', undefined, tenantId);
  }

  async getTenantRoles(tenantId: string) {
    return this.request<import('@/types').TenantRole[]>('GET', '/tenant/roles', undefined, tenantId);
  }

  async getTenantPackage(tenantId: string) {
    return this.request<import('@/types').TenantPackage>('GET', '/tenant/package', undefined, tenantId);
  }

  async createTenant(data: { code: string; name: string; platform_name: string; enterprise_id?: string; admin_username?: string; admin_password?: string; admin_phone?: string; initial_credits?: number; agent_codes?: string[]; database_bindings?: Record<string, Array<{ name: string; type: string; description?: string; config?: Record<string, unknown> }>> }) {
    return this.request('POST', '/platform/tenants', data);
  }

  async getTenantCredits(tenantId: string) {
    return this.request<import('@/types').TenantCreditsData>('GET', `/platform/tenants/${tenantId}/credits`);
  }

  async rechargeTenantCredits(tenantId: string, amount: number, reason?: string) {
    return this.request<{ balance: number; entry: import('@/types').TenantCreditRecord }>('POST', `/platform/tenants/${tenantId}/credits`, { amount, reason: reason || '管理员充值' });
  }

  async getTenantAgents(tenantId: string) {
    return this.request<import('@/types').TenantAgentsData>('GET', `/platform/tenants/${tenantId}/agents`);
  }

  async updateTenantAgents(tenantId: string, agentCodes: string[], databaseBindings?: Record<string, import('@/types').TenantAgentBinding[]>) {
    const payload: Record<string, unknown> = { agent_codes: agentCodes };
    if (databaseBindings) {
      payload.database_bindings = databaseBindings;
    }
    return this.request<{ assigned: string[]; available: import('@/types').AgentInfo[]; bindings?: Record<string, import('@/types').TenantAgentBinding[]> }>('PUT', `/platform/tenants/${tenantId}/agents`, payload);
  }

  async updateTenant(tenantId: string, data: Partial<import('@/types').TenantInfo>) {
    return this.request('PUT', '/tenant/info', data, tenantId);
  }

  async createMember(tenantId: string, data: { username: string; password: string; phone?: string; role_id: number }) {
    return this.request('POST', '/tenant/members/create', data, tenantId);
  }

  async updateMember(tenantId: string, memberId: number, data: Record<string, unknown>) {
    return this.request('PUT', `/tenant/members/${memberId}`, data, tenantId);
  }

  async deleteMember(tenantId: string, memberId: number) {
    return this.request('DELETE', `/tenant/members/${memberId}/delete`, undefined, tenantId);
  }

  // Roles
  async createRole(tenantId: string, data: Record<string, unknown>) {
    return this.request('POST', '/tenant/roles/create', data, tenantId);
  }

  async updateRole(tenantId: string, roleId: number, data: Record<string, unknown>) {
    return this.request('PUT', `/tenant/roles/${roleId}`, data, tenantId);
  }

  async deleteRole(tenantId: string, roleId: number) {
    return this.request('DELETE', `/tenant/roles/${roleId}/delete`, undefined, tenantId);
  }

  async getPermissions(tenantId: string) {
    return this.request<import('@/types').PermissionItem[]>('GET', '/tenant/permissions', undefined, tenantId);
  }

  // Models
  async getModels() {
    return this.request<import('@/types').AIModel[]>('GET', '/models/list');
  }

  async getModelKeys(modelId?: number) {
    const qs = modelId ? `?model_id=${modelId}` : '';
    return this.request<import('@/types').ModelKey[]>(`GET`, `/models/keys${qs}`);
  }

  async addModelKey(data: { model_id: number; key_alias: string; api_key: string; endpoint: string; priority: number; daily_quota: number }) {
    return this.request('POST', '/models/keys', data);
  }

  async updateModelKey(keyId: number, data: Record<string, unknown>) {
    return this.request('PUT', `/models/keys/${keyId}`, data);
  }

  async deleteModelKey(keyId: number) {
    return this.request('DELETE', `/models/keys/${keyId}`);
  }

  async getTokenUsage() {
    return this.request<import('@/types').TokenUsageStats>('GET', '/models/token-usage');
  }

  async getRoutingStrategies() {
    return this.request<import('@/types').RoutingStrategy[]>('GET', '/models/routing');
  }

  async createRoutingStrategy(data: Record<string, unknown>) {
    return this.request('POST', '/models/routing', data);
  }

  async updateRoutingStrategy(id: number, data: Record<string, unknown>) {
    return this.request('PUT', `/models/routing/${id}`, data);
  }

  async deleteRoutingStrategy(id: number) {
    return this.request('DELETE', `/models/routing/${id}`);
  }

  async getCircuitBreakers() {
    return this.request<import('@/types').CircuitBreakerState[]>('GET', '/models/circuit-breakers');
  }

  async resetCircuitBreaker(modelId: number) {
    return this.request('POST', '/models/circuit-breakers/reset', { model_id: modelId });
  }

  async testModel(data: { model_id: number; prompt: string }) {
    return this.request('POST', '/models/test', data);
  }

  async deployModel(modelId: number) {
    return this.request('POST', '/models/deploy', { model_id: modelId });
  }

  // Agent Configs
  async getAgentConfigs() {
    return this.request<import('@/types').AgentConfigItem[]>('GET', '/config/');
  }

  async updateAgentConfigs(configs: import('@/types').AgentConfigItem[]) {
    return this.request('PUT', '/config/', { configs });
  }

  // Dify
  async getDifyConfig() {
    return this.request<import('@/types').DifyConfig>('GET', '/config/dify');
  }

  async updateDifyConfig(data: Record<string, unknown>) {
    return this.request('PUT', '/config/dify', data);
  }

  // Database / Connectors
  async getConnectors() {
    return this.request<import('@/types').DataConnector[]>('GET', '/connectors');
  }

  async createConnector(data: Record<string, unknown>) {
    return this.request('POST', '/connectors', data);
  }

  async updateConnector(id: number, data: Record<string, unknown>) {
    return this.request('PUT', `/connectors/${id}`, data);
  }

  async deleteConnector(id: number) {
    return this.request('DELETE', `/connectors/${id}/delete`);
  }

  // Platform Databases (SaaS 平台配置 + 企业同步)
  async getPlatformDatabases() {
    return this.request<{ databases: import('@/types').PlatformDatabase[] }>('GET', '/platform-databases/');
  }

  async getPlatformDatabase(id: number) {
    return this.request<import('@/types').PlatformDatabase>('GET', `/platform-databases/${id}/`);
  }

  async createPlatformDatabase(data: Record<string, unknown>) {
    return this.request('POST', '/platform-databases/', data);
  }

  async updatePlatformDatabase(id: number, data: Record<string, unknown>) {
    return this.request('PUT', `/platform-databases/${id}/`, data);
  }

  async deletePlatformDatabase(id: number) {
    return this.request('DELETE', `/platform-databases/${id}/`);
  }

  async syncPlatformDatabase(id: number) {
    return this.request('POST', `/platform-databases/${id}/sync/`);
  }

  async getMatchPreview() {
    return this.request<{
      enterprises: import('@/types').PlatformEnterprise[];
      total: number;
      matched: number;
      unmatched: number;
    }>('GET', '/platform-databases/match-preview/');
  }

  async matchEnterprise(enterpriseId: number, data: { tenant_id?: number; enterprise_id?: string }) {
    return this.request('POST', `/platform-databases/enterprises/${enterpriseId}/match/`, data);
  }

  async matchAllForTenant(tenantId: number) {
    return this.request('POST', `/platform-databases/tenants/${tenantId}/match-all/`);
  }

  // ========== 公共数据库 ==========
  // 供应商
  async getPdbSuppliers(params?: { search?: string }) {
    const query = params?.search ? `?search=${encodeURIComponent(params.search)}` : '';
    return this.request<import('@/types').PdbSupplier[]>('GET', `/public-databases/suppliers/${query}`);
  }
  async getPdbSupplier(id: number) {
    return this.request<import('@/types').PdbSupplier>('GET', `/public-databases/suppliers/${id}/`);
  }
  async createPdbSupplier(data: Record<string, unknown>) {
    return this.request('POST', '/public-databases/suppliers/create/', data);
  }
  async updatePdbSupplier(id: number, data: Record<string, unknown>) {
    return this.request('PUT', `/public-databases/suppliers/${id}/`, data);
  }
  async deletePdbSupplier(id: number) {
    return this.request('DELETE', `/public-databases/suppliers/${id}/`);
  }
  async verifyPdbSupplier(id: number, data: { approved: boolean; remark?: string }) {
    return this.request('POST', `/public-databases/suppliers/${id}/verify/`, data);
  }
  async syncPdbSupplierProducts(id: number) {
    return this.request('POST', `/public-databases/suppliers/${id}/sync/`);
  }
  async getPdbSupplierQualifications(supplierId: number) {
    return this.request('GET', `/public-databases/suppliers/${supplierId}/qualifications/`);
  }
  async addPdbSupplierQualification(supplierId: number, data: Record<string, unknown>) {
    return this.request('POST', `/public-databases/suppliers/${supplierId}/qualifications/`, data);
  }

  // 产品
  async getPdbProducts(params?: { search?: string; supplier_id?: number; category?: string; page?: number; page_size?: number }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.supplier_id) query.set('supplier_id', String(params.supplier_id));
    if (params?.category) query.set('category', params.category);
    if (params?.page) query.set('page', String(params.page));
    if (params?.page_size) query.set('page_size', String(params.page_size));
    const qs = query.toString();
    return this.request<{ total: number; page: number; page_size: number; results: import('@/types').PdbProduct[] }>('GET', `/public-databases/products/${qs ? `?${qs}` : ''}`);
  }
  async getPdbProduct(id: number) {
    return this.request<import('@/types').PdbProduct>('GET', `/public-databases/products/${id}/`);
  }
  async createPdbProduct(data: Record<string, unknown>) {
    return this.request('POST', '/public-databases/products/create/', data);
  }
  async updatePdbProduct(id: number, data: Record<string, unknown>) {
    return this.request('PUT', `/public-databases/products/${id}/`, data);
  }
  async deletePdbProduct(id: number) {
    return this.request('DELETE', `/public-databases/products/${id}/`);
  }
  async getPdbProductSuppliers() {
    return this.request('GET', '/public-databases/products/create/');
  }

  // 集采
  async getPdbCollectiveBatches(status?: string) {
    const qs = status ? `?status=${status}` : '';
    return this.request<import('@/types').PdbCollectiveBatch[]>('GET', `/public-databases/collective-batches/${qs}`);
  }
  async getPdbCollectiveBatch(id: number) {
    return this.request<import('@/types').PdbCollectiveBatch>('GET', `/public-databases/collective-batches/${id}/`);
  }
  async notifyCollectiveBatches(batchDate?: string) {
    return this.request('POST', '/public-databases/collective-batches/notify/', { batch_date: batchDate });
  }
  async quoteCollectiveBatch(id: number, quotedPrice: string) {
    return this.request('POST', `/public-databases/collective-batches/${id}/quote/`, { quoted_price: quotedPrice });
  }
  async distributeCollectiveBatches() {
    return this.request('POST', '/public-databases/collective-batches/distribute/');
  }

  // 集采公告
  async getAnnouncements(status?: string) {
    const qs = status ? `?status=${status}` : '';
    return this.request<import('@/types').CollectiveAnnouncement[]>('GET', `/public-databases/announcements/${qs}`);
  }
  async getAnnouncement(id: number) {
    return this.request<import('@/types').CollectiveAnnouncement>('GET', `/public-databases/announcements/${id}/`);
  }
  async createAnnouncement(data: {
    title: string; quote_deadline: string; order_deadline: string;
    description?: string; product_keywords?: string; supplier_ids?: string; notes?: string;
  }) {
    return this.request('POST', '/public-databases/announcements/create/', data);
  }
  async updateAnnouncement(id: number, data: Record<string, unknown>) {
    return this.request('PUT', `/public-databases/announcements/${id}/`, data);
  }
  async deleteAnnouncement(id: number) {
    return this.request('DELETE', `/public-databases/announcements/${id}/`);
  }
  async publishAnnouncement(id: number) {
    return this.request('POST', `/public-databases/announcements/${id}/publish/`);
  }
  async aggregateAnnouncement(id: number) {
    return this.request<import('@/types').AggregateItem[]>('POST', `/public-databases/announcements/${id}/aggregate/`);
  }
  async pushAnnouncementToSuppliers(id: number) {
    return this.request('POST', `/public-databases/announcements/${id}/push-suppliers/`);
  }
  async distributeAnnouncement(id: number) {
    return this.request('POST', `/public-databases/announcements/${id}/distribute/`);
  }
  async closeAnnouncement(id: number) {
    return this.request('POST', `/public-databases/announcements/${id}/close/`);
  }
  async cancelAnnouncement(id: number) {
    return this.request('POST', `/public-databases/announcements/${id}/cancel/`);
  }

  // 供应商账号
  async getSupplierAccounts() {
    return this.request<import('@/types').SupplierAccount[]>('GET', '/public-databases/supplier-accounts/');
  }
  async createSupplierAccount(data: { supplier_id: number; username: string; password: string; contact_name?: string; contact_phone?: string }) {
    return this.request<import('@/types').SupplierAccount>('POST', '/public-databases/supplier-accounts/create/', data);
  }
  async updateSupplierAccount(id: number, data: { contact_name?: string; contact_phone?: string; enabled?: boolean; password?: string; regenerate_token?: boolean }) {
    return this.request<import('@/types').SupplierAccount>('PUT', `/public-databases/supplier-accounts/${id}/`, data);
  }
  async deleteSupplierAccount(id: number) {
    return this.request('DELETE', `/public-databases/supplier-accounts/${id}/`);
  }

  // 供应商配送规则
  async getDeliveryRules(supplierId?: number) {
    const qs = supplierId ? `?supplier_id=${supplierId}` : '';
    return this.request<import('@/types').SupplierDeliveryRule[]>('GET', `/public-databases/delivery-rules/${qs}`);
  }
  async createDeliveryRule(data: {
    supplier: number; province?: string; city?: string;
    delivery_hours?: number; min_order_amount?: string; enabled?: boolean;
  }) {
    return this.request('POST', '/public-databases/delivery-rules/create/', data);
  }
  async updateDeliveryRule(id: number, data: Record<string, unknown>) {
    return this.request('PUT', `/public-databases/delivery-rules/${id}/`, data);
  }
  async deleteDeliveryRule(id: number) {
    return this.request('DELETE', `/public-databases/delivery-rules/${id}/`);
  }

  // 报价
  async getPdbQuotes(params?: { status?: string; quote_type?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.quote_type) query.set('quote_type', params.quote_type);
    const qs = query.toString();
    return this.request<import('@/types').PdbQuote[]>('GET', `/public-databases/quotes/${qs ? `?${qs}` : ''}`);
  }
  async createQuickQuote(data: { tenant_id: number; product_id: number; quantity: number; agent_id?: string; notes?: string }) {
    return this.request('POST', '/public-databases/quotes/quick/', data);
  }
  async createCollectiveQuote(data: { tenant_id: number; product_id: number; quantity: number; agent_id?: string; notes?: string }) {
    return this.request('POST', '/public-databases/quotes/collective/', data);
  }
  async acceptQuote(id: number) {
    return this.request('POST', `/public-databases/quotes/${id}/accept/`);
  }
  async rejectQuote(id: number) {
    return this.request('POST', `/public-databases/quotes/${id}/reject/`);
  }

  // 订单
  async getPdbOrders(status?: string) {
    const qs = status ? `?status=${status}` : '';
    return this.request<import('@/types').PdbOrder[]>('GET', `/public-databases/orders/${qs}`);
  }
  async getPdbOrder(id: number) {
    return this.request<import('@/types').PdbOrder>('GET', `/public-databases/orders/${id}/`);
  }
  async createPdbOrder(data: { quote_id: number; quantity?: number; payment_method?: string; notes?: string }) {
    return this.request('POST', '/public-databases/orders/create/', data);
  }
  async syncOrderToSupplier(id: number) {
    return this.request('POST', `/public-databases/orders/${id}/sync-supplier/`);
  }
  async initOrderQualification(id: number, data: { buyer_qualifications?: unknown[] }) {
    return this.request('POST', `/public-databases/orders/${id}/qualification/`, data);
  }
  async initOrderESign(id: number) {
    return this.request('POST', `/public-databases/orders/${id}/e-sign/`);
  }
  async completeOrderSign(id: number) {
    return this.request('POST', `/public-databases/orders/${id}/complete-sign/`);
  }

  // 支付
  async getPdbPayments() {
    return this.request<{ data: import('@/types').PdbPaymentRecord[] }>('GET', '/public-databases/payments/');
  }
  async createPayment(orderId: number, paymentMethod: string) {
    return this.request('POST', `/public-databases/orders/${orderId}/pay/`, { payment_method: paymentMethod });
  }
  async processPayment(id: number) {
    return this.request('POST', `/public-databases/payments/${id}/process/`);
  }

  // 统计
  async getPdbStatistics() {
    return this.request<{
      payment: { total_amount: string; total_commission: string; total_supplier: string; total_count: number };
      orders: { total: number; by_status: Record<string, { label: string; count: number }> };
      suppliers: Array<{ id: number; name: string; product_count: number; order_count: number; total_amount: string; commission: string }>;
      trend?: Array<{ date: string; amount: string }>;
    }>('GET', '/public-databases/statistics/');
  }

  // Dashboard
  async getDashboardOverview() {
    return this.request<import('@/types').DashboardOverview>('GET', '/dashboard/overview');
  }

  async getDashboardKPI() {
    return this.request<import('@/types').DashboardKPI[]>('GET', '/dashboard/kpi');
  }

  async getDashboardAlerts() {
    return this.request<import('@/types').DashboardAlert[]>('GET', '/dashboard/alerts');
  }

  // Knowledge / Workflows
  async getKnowledgeDocs(tenantId?: string) {
    return this.request<import('@/types').KnowledgeDoc[]>('GET', '/docs', undefined, tenantId);
  }

  async createKnowledgeDoc(tenantId: string, data: Record<string, unknown>) {
    return this.request('POST', '/docs', data, tenantId);
  }

  async updateKnowledgeDoc(tenantId: string, docId: number, data: Record<string, unknown>) {
    return this.request('PUT', `/docs/${docId}`, data, tenantId);
  }

  async deleteKnowledgeDoc(tenantId: string, docId: number) {
    return this.request('DELETE', `/docs/${docId}/delete`, undefined, tenantId);
  }

  async getKnowledgeDocContent(tenantId: string, docId: number) {
    return this.request<import('@/types').KnowledgeDoc & { content_text: string }>('GET', `/docs/${docId}/content`, undefined, tenantId);
  }

  // ========== 工作流模板 ==========
  async getWorkflowTemplates(all: boolean = false) {
    const qs = all ? '?all=1' : '';
    return this.request<import('@/types').WorkflowTemplate[]>('GET', `/workflow-templates${qs}`);
  }

  async createWorkflowTemplate(data: {
    name: string;
    description?: string;
    category?: string;
    tags?: string[];
    steps: import('@/types').WorkflowStep[];
    edges: import('@/types').WorkflowEdge[];
    enabled?: boolean;
    sort_order?: number;
  }) {
    return this.request('POST', '/workflow-templates/create', data);
  }

  async updateWorkflowTemplate(id: number, data: Partial<{
    name: string;
    description: string;
    category: string;
    tags: string[];
    steps: import('@/types').WorkflowStep[];
    edges: import('@/types').WorkflowEdge[];
    enabled: boolean;
    sort_order: number;
  }>) {
    return this.request('PUT', `/workflow-templates/${id}`, data);
  }

  async deleteWorkflowTemplate(id: number) {
    return this.request('DELETE', `/workflow-templates/${id}`);
  }

  // ========== 平台智能体 ==========
  async getAgents(all: boolean = false) {
    const qs = all ? '?all=1' : '';
    return this.request<import('@/types').AgentInfo[]>('GET', `/agents${qs}`);
  }

  async createAgent(data: Partial<{
    agent_id: string;
    code: string;
    name: string;
    role: string;
    emoji: string;
    scarf_color: string;
    accent: string;
    description: string;
    capabilities: string[];
    agent_role_id: number | null;
    default_workflow_template_id: number | null;
    sort_order: number;
    enabled: boolean;
  }>) {
    return this.request<import('@/types').AgentInfo>('POST', '/agents/create', data);
  }

  async deleteAgent(id: number) {
    return this.request('DELETE', `/agents/${id}`);
  }

  async getPublicDatabases() {
    return this.request<{ databases: unknown[]; msg: string }>('GET', '/agents/public-databases');
  }

  async updateAgent(id: number, data: Partial<{
    name: string;
    role: string;
    description: string;
    emoji: string;
    scarf_color: string;
    accent: string;
    agent_role_id: number | null;
    default_workflow_template_id: number | null;
    enabled: boolean;
    sort_order: number;
  }>) {
    return this.request('PUT', `/agents/${id}`, data);
  }

  // ========== 智能体角色 ==========
  async getAgentRoles(all: boolean = true) {
    const qs = all ? '?all=1' : '';
    return this.request<import('@/types').AgentRole[]>('GET', `/agents/roles${qs}`);
  }

  async createAgentRole(data: Record<string, unknown>) {
    return this.request('POST', '/agents/roles/create', data);
  }

  async updateAgentRole(id: number, data: Record<string, unknown>) {
    return this.request('PUT', `/agents/roles/${id}`, data);
  }

  async deleteAgentRole(id: number) {
    return this.request('DELETE', `/agents/roles/${id}`);
  }

  // ========== 营销素材 ==========
  async getMediaAssets(tenantId?: string) {
    return this.request<import('@/types').MediaAsset[]>('GET', '/assets', undefined, tenantId);
  }

  async createMediaAsset(tenantId: string, data: { name: string; type: string; size: string; url?: string; folder?: string; description?: string }) {
    return this.request('POST', '/assets', data, tenantId);
  }

  /** 上传营销素材文件（multipart/form-data） */
  async uploadMediaAsset(tenantId: string, file: File, opts?: { type?: string; folder?: string; name?: string; description?: string }) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', opts?.type || 'file');
    formData.append('folder', opts?.folder || '全部');
    if (opts?.name) formData.append('name', opts?.name);
    if (opts?.description) formData.append('description', opts?.description);

    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    headers['X-Tenant-ID'] = tenantId;

    const url = `${this.baseUrl}${this.normalizePath('/assets')}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (res.status === 401) {
      this.setToken(null);
      window.location.href = '/admin/';
      return new Promise<ApiResponse<import('@/types').MediaAsset>>(() => {});
    }
    const data: ApiResponse<import('@/types').MediaAsset> = await res.json();
    if (data.code !== 0) throw new Error(data.msg || '上传失败');
    return data;
  }

  /** 更新营销素材（绑定智能体等） */
  async updateMediaAsset(tenantId: string, assetId: number, data: Record<string, unknown>) {
    return this.request('PUT', `/assets/${assetId}`, data, tenantId);
  }

  async deleteMediaAsset(tenantId: string, assetId: number) {
    return this.request('DELETE', `/assets/${assetId}`, undefined, tenantId);
  }

  // ========== 租户智能体配置 ==========
  async getAgentConfig(tenantId: string, agentId: string) {
    return this.request<import('@/types').AgentConfigItem>('GET', `/agents/configs/${agentId}`, undefined, tenantId);
  }

  async updateAgentConfig(tenantId: string, agentId: string, data: Record<string, unknown>) {
    return this.request('PUT', `/agents/configs/${agentId}`, data, tenantId);
  }

  // Security
  async getAuditLogs(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<import('@/types').AuditLog[]>('GET', `/security/audit-logs${qs}`);
  }

  async getAuditStats() {
    return this.request<Record<string, unknown>>('GET', '/security/audit-logs/stats');
  }

  async getSecurityOverview() {
    return this.request<import('@/types').SecurityOverview>('GET', '/security/overview');
  }

  async getSecurityEvents() {
    return this.request<import('@/types').SecurityEvent[]>('GET', '/security/events');
  }

  async resolveSecurityEvent(eventId: number) {
    return this.request('PUT', `/security/events/${eventId}/resolve`);
  }

  async getSecurityConfig() {
    return this.request<Record<string, unknown>>('GET', '/security/config');
  }

  async updateSecurityConfig(data: Record<string, unknown>) {
    return this.request('PUT', '/security/config', data);
  }

  async getAccessRules() {
    return this.request<Record<string, unknown>[]>('GET', '/security/access-rules');
  }

  async createAccessRule(data: Record<string, unknown>) {
    return this.request('POST', '/security/access-rules', data);
  }

  async deleteAccessRule(ruleId: number) {
    return this.request('DELETE', `/security/access-rules/${ruleId}`);
  }

  // Prompts (提示词)
  async getPrompts(type?: 'home' | 'chat' | 'purchase_chat' | 'purchase_home', category?: string, all: boolean = true) {
    const qs = new URLSearchParams();
    if (type) qs.set('type', type);
    if (category) qs.set('category', category);
    if (all) qs.set('all', '1');
    const q = qs.toString();
    return this.request<import('@/types').PromptItem[]>(
      'GET',
      `/prompts${q ? `?${q}` : ''}`,
    );
  }

  async createPrompt(data: Record<string, unknown>) {
    return this.request('POST', '/prompts/create', data);
  }

  async updatePrompt(id: number, data: Record<string, unknown>) {
    return this.request('PUT', `/prompts/${id}`, data);
  }

  async deletePrompt(id: number) {
    return this.request('DELETE', `/prompts/${id}`);
  }

  // ========== 平台权限管理（第二层） ==========

  /** 获取平台权限清单 */
  async getPlatformPermissions() {
    return this.request<import('@/types').PermissionItem[]>('GET', '/admin/permissions');
  }

  /** 获取平台角色列表 */
  async getPlatformRoles() {
    return this.request<import('@/types').PlatformRole[]>('GET', '/admin/roles');
  }

  /** 创建平台角色 */
  async createPlatformRole(data: { name: string; code: string; description?: string; permissions: string[] }) {
    return this.request('POST', '/admin/roles/create', data);
  }

  /** 更新平台角色 */
  async updatePlatformRole(roleId: string | number, data: { name?: string; code?: string; description?: string; permissions?: string[] }) {
    return this.request('PUT', `/admin/roles/${roleId}`, data);
  }

  /** 删除平台角色 */
  async deletePlatformRole(roleId: string | number) {
    return this.request('DELETE', `/admin/roles/${roleId}/delete`);
  }

  /** 获取总部员工列表 */
  async getPlatformStaff() {
    return this.request<import('@/types').PlatformStaff[]>('GET', '/admin/staff');
  }

  /** 创建总部员工 */
  async createPlatformStaff(data: { username: string; password?: string; name: string; phone: string; role_id: number }) {
    return this.request('POST', '/admin/staff/create', data);
  }

  /** 更新总部��工 */
  async updatePlatformStaff(staffId: string | number, data: { username?: string; name?: string; phone?: string; role_id?: number; enabled?: boolean; password?: string }) {
    return this.request('PUT', `/admin/staff/${staffId}`, data);
  }

  /** 删除总部员工 */
  async deletePlatformStaff(staffId: string | number) {
    return this.request('DELETE', `/admin/staff/${staffId}/delete`);
  }

  // ========== 积分管理 ==========
  async getCreditConfig() {
    return this.request<import('@/types').CreditConfig>('GET', '/admin/credits/config/');
  }

  async updateCreditConfig(data: Partial<import('@/types').CreditConfig>) {
    return this.request<import('@/types').CreditConfig>('PUT', '/admin/credits/config/update/', data);
  }

  async getCreditPackages() {
    return this.request<import('@/types').CreditPackage[]>('GET', '/admin/credits/packages/');
  }

  async createCreditPackage(data: Partial<import('@/types').CreditPackage>) {
    return this.request<import('@/types').CreditPackage>('POST', '/admin/credits/packages/create/', data);
  }

  async updateCreditPackage(id: number, data: Partial<import('@/types').CreditPackage>) {
    return this.request<import('@/types').CreditPackage>('PUT', `/admin/credits/packages/${id}/`, data);
  }

  async deleteCreditPackage(id: number) {
    return this.request('DELETE', `/admin/credits/packages/${id}/delete/`);
  }

  async getAgentCreditRules() {
    return this.request<import('@/types').AgentCreditRule[]>('GET', '/admin/credits/agent-rules/');
  }

  async updateAgentCreditRule(id: number, data: Partial<import('@/types').AgentCreditRule>) {
    return this.request<import('@/types').AgentCreditRule>('PUT', `/admin/credits/agent-rules/${id}/`, data);
  }

  async getCreditOrders(params?: { status?: string; tenant_id?: string; page?: number; page_size?: number }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.tenant_id) query.set('tenant_id', params.tenant_id);
    if (params?.page) query.set('page', String(params.page));
    if (params?.page_size) query.set('page_size', String(params.page_size));
    const qs = query.toString();
    return this.request<import('@/types').CreditOrderListResponse>('GET', `/admin/credits/orders/${qs ? `?${qs}` : ''}`);
  }

  async confirmCreditOrder(orderId: number) {
    return this.request<{ order: import('@/types').CreditOrder; tenant_credits: number }>('POST', `/admin/credits/orders/${orderId}/confirm/`);
  }

  async cancelCreditOrder(orderId: number) {
    return this.request<import('@/types').CreditOrder>('POST', `/admin/credits/orders/${orderId}/cancel/`);
  }

  async manualRechargeCredits(data: { tenant_id: number; amount: number; reason?: string }) {
    return this.request<{ order: import('@/types').CreditOrder; tenant_credits: number }>('POST', '/admin/credits/recharge/', data);
  }

  async getCreditStats() {
    return this.request<import('@/types').CreditStats>('GET', '/admin/credits/stats/');
  }

  // ========== 供应商提现管理 ==========
  async getAdminWithdrawals(params?: { status?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return this.request<{
      stats: {
        pending: number;
        processing: number;
        completed: number;
        rejected: number;
        cancelled: number;
        pending_amount: string;
        completed_amount: string;
      };
      records: AdminWithdrawalRecord[];
    }>('GET', `/public-databases/admin/withdrawals/${qs ? `?${qs}` : ''}`);
  }

  async approveWithdrawal(id: number, adminRemark?: string) {
    return this.request('POST', `/public-databases/admin/withdrawals/${id}/approve/`, { admin_remark: adminRemark || '' });
  }

  async rejectWithdrawal(id: number, adminRemark: string) {
    return this.request('POST', `/public-databases/admin/withdrawals/${id}/reject/`, { admin_remark: adminRemark });
  }

  async completeWithdrawal(id: number, adminRemark?: string) {
    return this.request('POST', `/public-databases/admin/withdrawals/${id}/complete/`, { admin_remark: adminRemark || '' });
  }

  async getAdminWallets() {
    return this.request<AdminWalletItem[]>('GET', '/public-databases/admin/wallets/');
  }

  // ========== 企微管理 ==========
  async getWecomConfig() {
    return this.request<import('@/types').WecomGlobalConfig>('GET', '/admin/wecom/config/');
  }

  async updateWecomConfig(data: Partial<import('@/types').WecomGlobalConfig>) {
    return this.request<import('@/types').WecomGlobalConfig>('PUT', '/admin/wecom/config/', data);
  }

  async getWecomAreaCodes() {
    return this.request<import('@/types').WecomAreaCode[]>('GET', '/admin/wecom/area-codes/');
  }

  async getWecomNumbers(params?: { tenant_id?: string; status?: string }) {
    const query = new URLSearchParams();
    if (params?.tenant_id) query.set('tenant_id', params.tenant_id);
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    return this.request<import('@/types').WecomNumber[]>('GET', `/admin/wecom/numbers/${qs ? `?${qs}` : ''}`);
  }

  async createWecomNumber(data: {
    tenant_id?: number;
    province_code: string;
    province_name: string;
    remark?: string;
    expires_at?: string;
    price?: string;
    device_name?: string;
    device_type?: number;
    proxy_url?: string;
    client_version?: string;
  }) {
    return this.request<import('@/types').WecomNumber>('POST', '/admin/wecom/numbers/', data);
  }

  async updateWecomNumber(id: number, data: Partial<import('@/types').WecomNumber>) {
    return this.request<import('@/types').WecomNumber>('PATCH', `/admin/wecom/numbers/${id}/`, data);
  }

  async deleteWecomNumber(id: number) {
    return this.request('DELETE', `/admin/wecom/numbers/${id}/`);
  }
}

// ========== 提现管理类型 ==========
export interface AdminWithdrawalRecord {
  id: number;
  withdrawal_number: string;
  supplier_name: string;
  supplier_code: string;
  amount: string;
  fee: string;
  net_amount: string;
  bank_name: string;
  bank_account: string;
  bank_holder: string;
  remark: string;
  status: string;
  status_display: string;
  admin_remark: string;
  processed_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminWalletItem {
  supplier_id: number;
  supplier_name: string;
  supplier_code: string;
  bank_name: string;
  bank_account: string;
  bank_holder: string;
  total_earned: string;
  total_refunded: string;
  total_withdrawn: string;
  pending_withdrawal: string;
  available_balance: string;
}

export const api = new AdminApiClient();

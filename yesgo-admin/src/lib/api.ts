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
      const [base, query] = path.split('?');
      return `${base.endsWith('/') ? base : base + '/'}`;
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
      throw new Error('会话已过期，请重新登录');
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
      user: { id: number; username: string; email: string; is_superuser: boolean };
      tenant: { id: number; code: string; name: string; status: string };
    }>('POST', '/auth/login', { username, password });
    if (res.data.access_token) {
      this.setToken(res.data.access_token);
    }
    return res;
  }

  async me() {
    return this.request<{
      user: { id: string; name: string; roleId: string; roleName: string };
      tenant: import('@/types').TenantInfo;
    }>('GET', '/auth/me');
  }

  async logout() {
    return this.request('POST', '/auth/logout');
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

  async createTenant(data: { code: string; name: string; platform_name: string }) {
    return this.request('POST', '/platform/tenants', data);
  }

  async updateTenant(tenantId: string, data: Partial<import('@/types').TenantInfo>) {
    return this.request('PUT', '/tenant/info', data, tenantId);
  }

  async createMember(tenantId: string, data: { username: string; password: string; role_id: number }) {
    return this.request('POST', '/tenant/members/create', data, tenantId);
  }

  async updateMember(tenantId: string, memberId: number, data: Record<string, unknown>) {
    return this.request('PUT', `/tenant/members/${memberId}`, data, tenantId);
  }

  async deleteMember(tenantId: string, memberId: number) {
    return this.request('DELETE', `/tenant/members/${memberId}/delete`, undefined, tenantId);
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

  async deleteKnowledgeDoc(tenantId: string, docId: number) {
    return this.request('DELETE', `/docs/${docId}`, undefined, tenantId);
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
}

export const api = new AdminApiClient();

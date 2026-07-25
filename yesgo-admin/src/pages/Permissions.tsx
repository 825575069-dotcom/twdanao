// ============================================================
// YesGo Admin — 权限管理（员工管理 + 角色权限）
// ============================================================
import { useState } from 'react';
import {
  Users, UserCog, Search, Plus, MoreHorizontal, Pencil, Trash2,
  Shield, CheckCircle2, XCircle, Loader2,
} from 'lucide-react';

interface Employee {
  id: number;
  name: string;
  username: string;
  department: string;
  role: string;
  status: 'active' | 'inactive';
  created_at: string;
}

interface Role {
  id: number;
  name: string;
  description: string;
  permissions: string[];
  member_count: number;
  status: 'active' | 'inactive';
}

const MOCK_EMPLOYEES: Employee[] = [
  { id: 1, name: '张三', username: 'zhangsan', department: '运营部', role: '管理员', status: 'active', created_at: '2026-07-20 10:00' },
  { id: 2, name: '李四', username: 'lisi', department: '销售部', role: '普通员工', status: 'active', created_at: '2026-07-21 14:30' },
  { id: 3, name: '王五', username: 'wangwu', department: '采购部', role: '普通员工', status: 'inactive', created_at: '2026-07-22 09:15' },
  { id: 4, name: '赵六', username: 'zhaoliu', department: '学术部', role: '部门主管', status: 'active', created_at: '2026-07-23 16:45' },
];

const MOCK_ROLES: Role[] = [
  { id: 1, name: '超级管理员', description: '全部功能权限', permissions: ['*'], member_count: 1, status: 'active' },
  { id: 2, name: '租户管理员', description: '管理租户下员工和数据', permissions: ['tenant:read', 'tenant:write', 'member:manage'], member_count: 2, status: 'active' },
  { id: 3, name: '普通员工', description: '仅可操作分配给自己的智能体', permissions: ['agent:operate', 'chat:use'], member_count: 12, status: 'active' },
  { id: 4, name: '审计员', description: '只读查看安全日志', permissions: ['security:read'], member_count: 1, status: 'inactive' },
];

const STATUS_BADGE = {
  active: <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700"><CheckCircle2 size={12} />启用</span>,
  inactive: <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"><XCircle size={12} />禁用</span>,
};

export default function Permissions() {
  const [activeTab, setActiveTab] = useState<'employees' | 'roles'>('employees');
  const [employeeKeyword, setEmployeeKeyword] = useState('');
  const [roleKeyword, setRoleKeyword] = useState('');

  const filteredEmployees = MOCK_EMPLOYEES.filter(e =>
    e.name.includes(employeeKeyword) || e.username.includes(employeeKeyword) || e.department.includes(employeeKeyword)
  );
  const filteredRoles = MOCK_ROLES.filter(r =>
    r.name.includes(roleKeyword) || r.description.includes(roleKeyword)
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="text-primary-600" size={28} />
          权限管理
        </h1>
        <p className="text-sm text-gray-500 mt-1">管理租户下的员工账号与角色权限配置</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('employees')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'employees'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users size={16} />
          员工管理
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'roles'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <UserCog size={16} />
          角色权限
        </button>
      </div>

      {activeTab === 'employees' ? (
        <div>
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="搜索姓名、账号、部门"
                value={employeeKeyword}
                onChange={(e) => setEmployeeKeyword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors">
              <Plus size={16} />
              新增员工
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">姓名</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">账号</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">部门</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">角色</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">状态</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">创建时间</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-900">{emp.name}</td>
                    <td className="px-5 py-3 text-gray-600">{emp.username}</td>
                    <td className="px-5 py-3 text-gray-600">{emp.department}</td>
                    <td className="px-5 py-3 text-gray-600">{emp.role}</td>
                    <td className="px-5 py-3">{STATUS_BADGE[emp.status]}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{emp.created_at}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors" title="编辑">
                          <Pencil size={16} />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="删除">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                      暂无匹配员工
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="搜索角色名称"
                value={roleKeyword}
                onChange={(e) => setRoleKeyword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors">
              <Plus size={16} />
              新增角色
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">角色名称</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">描述</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">权限清单</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">成员数</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">状态</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRoles.map((role) => (
                  <tr key={role.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-900">{role.name}</td>
                    <td className="px-5 py-3 text-gray-600 max-w-xs truncate">{role.description}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.map((p, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded-md bg-primary-50 text-primary-700 text-xs">
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{role.member_count} 人</td>
                    <td className="px-5 py-3">{STATUS_BADGE[role.status]}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors" title="编辑">
                          <Pencil size={16} />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="删除">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRoles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                      暂无匹配角色
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

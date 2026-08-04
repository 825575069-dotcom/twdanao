import { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from 'react'
import {
  FileText, Upload, Trash2, CheckCircle, AlertTriangle, XCircle,
  Loader2, RefreshCw, Shield, FileCheck2, PenTool, Eye, Clock, ChevronRight,
  Building2
} from 'lucide-react'
import { getApiClient } from '../lib/api'
import { API_BUSINESS_CODE } from '../lib/constants'

// ============================================================
// 类型定义
// ============================================================
interface TenantQualification {
  id: number
  tenant: number
  tenant_name: string
  qualification_type: string
  qualification_type_display: string
  qualification_name: string
  file_url: string
  file_name: string
  license_number: string
  issue_date: string | null
  expiry_date: string | null
  verified: boolean
  status: string
  status_display: string
  file_size: number
  created_at: string
  updated_at: string
}

export interface QualificationsTabHandle {
  refresh: () => void
  openUpload: () => void
}

export interface FirstOpsTabHandle {
  refresh: () => void
}

interface FirstOperationRecord {
  id: number
  record_number: string
  buyer_tenant: number
  buyer_tenant_name: string
  seller_supplier: number
  seller_supplier_name: string
  buyer_qualifications: unknown[]
  seller_qualifications: unknown[]
  buyer_confirmed: boolean
  buyer_confirmed_at: string | null
  seller_confirmed: boolean
  seller_confirmed_at: string | null
  buyer_remark: string
  seller_remark: string
  status: string
  status_display: string
  e_signature_service: string
  e_signature_contract_id: string
  e_signature_signed_at: string | null
  e_signature_contract_url: string
  valid_from: string | null
  valid_until: string | null
  is_valid: boolean
  external_reused: boolean
  external_source: string
  created_by: string
  notes: string
  created_at: string
  updated_at: string
}

// ============================================================
// 常量
// ============================================================
const QUAL_TYPES = [
  { value: 'business_license', label: '营业执照' },
  { value: 'gsp_certificate', label: 'GSP认证证书' },
  { value: 'drug_license', label: '药品经营许可证' },
  { value: 'medical_device_license', label: '医疗器械经营许可证' },
  { value: 'food_license', label: '食品经营许可证' },
  { value: 'pharmaceutical_production_license', label: '药品生产许可证' },
  { value: 'import_drug_license', label: '进口药品注册证' },
  { value: 'other', label: '其他' },
]

const FO_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-500 dark:text-gray-400' },
  submitted: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
  exchanged: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-600 dark:text-cyan-400' },
  signing: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
  signed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
  rejected: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-500 dark:text-gray-400' },
  expired: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-500 dark:text-gray-400' },
}

const FO_STATUS_FLOW = ['draft', 'submitted', 'exchanged', 'signing', 'signed']
const FO_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  submitted: '已提交',
  exchanged: '资质已互换',
  signing: '签章中',
  signed: '已签章',
  rejected: '已拒绝',
  expired: '已过期',
}

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 9999
  const target = new Date(dateStr)
  const now = new Date()
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ============================================================
// 主组件
// ============================================================
export default function QualificationView() {
  const [activeTab, setActiveTab] = useState<'qualifications' | 'firstOps'>('qualifications')
  const qualRef = useRef<QualificationsTabHandle>(null)
  const firstOpsRef = useRef<FirstOpsTabHandle>(null)

  const handleRefresh = () => {
    if (activeTab === 'qualifications') qualRef.current?.refresh()
    else firstOpsRef.current?.refresh()
  }

  return (
    <div className="mx-auto h-full max-w-6xl overflow-y-auto px-6 py-6">
      {/* Tab 与操作栏合并 */}
      <div className="mb-5 flex items-center justify-between border-b border-border-subtle">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('qualifications')}
            className={`flex items-center gap-1.5 border-b-2 px-1 py-3 text-sm font-medium transition-all ${
              activeTab === 'qualifications'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <FileText size={16} />
            企业资质
          </button>
          <button
            onClick={() => setActiveTab('firstOps')}
            className={`flex items-center gap-1.5 border-b-2 px-1 py-3 text-sm font-medium transition-all ${
              activeTab === 'firstOps'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <FileCheck2 size={16} />
            首营交换记录
          </button>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <button
            onClick={handleRefresh}
            className="icon-btn flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover"
          >
            <RefreshCw size={14} /> 刷新
          </button>
          {activeTab === 'qualifications' && (
            <button
              onClick={() => qualRef.current?.openUpload()}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
            >
              <Upload size={16} /> 上传资质
            </button>
          )}
        </div>
      </div>

      {activeTab === 'qualifications' ? <QualificationsTab ref={qualRef} /> : <FirstOpsTab ref={firstOpsRef} />}
    </div>
  )
}

// ============================================================
// Tab 1: 企业资质
// ============================================================
export const QualificationsTab = forwardRef<QualificationsTabHandle>(function QualificationsTab(_props, ref) {
  const api = getApiClient()
  const [qualifications, setQualifications] = useState<TenantQualification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingTarget, setEditingTarget] = useState<TenantQualification | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TenantQualification | null>(null)
  const [uploading, setUploading] = useState(false)

  const formatApiError = (msg: string) => {
    if (msg.includes('tenant_id')) return '未识别到租户信息，请重新登录或联系管理员'
    return msg
  }

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    api.pdb.tenantQualifications()
      .then((resp) => {
        if (resp.code === API_BUSINESS_CODE.SUCCESS && resp.data) {
          setQualifications(resp.data as TenantQualification[])
        } else {
          setQualifications([])
          if (resp.msg && !resp.msg.includes('Not Found')) setError(formatApiError(resp.msg))
        }
      })
      .catch(() => setError('加载资质列表失败，请检查网络连接'))
      .finally(() => setLoading(false))
  }, [api])

  useImperativeHandle(ref, () => ({
    refresh: load,
    openUpload: () => setShowModal(true),
  }))

  useEffect(() => { load() }, [load])

  // 统计
  const validCount = qualifications.filter(q => q.status === 'valid').length
  const expiringCount = qualifications.filter(q => q.status === 'expiring').length
  const expiredCount = qualifications.filter(q => q.status === 'expired').length

  const sorted = [...qualifications].sort((a, b) => {
    const aDays = daysUntil(a.expiry_date)
    const bDays = daysUntil(b.expiry_date)
    return aDays - bDays
  })

  return (
    <div>
      {/* 统计卡片 */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard label="有效资质" value={validCount} color="green" icon={CheckCircle} />
        <StatCard label="即将到期" value={expiringCount} color="orange" icon={AlertTriangle} />
        <StatCard label="已过期" value={expiredCount} color="gray" icon={XCircle} />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 rounded-lg border border-border-subtle bg-bg-hover px-4 py-3 text-sm text-text-secondary">
          {error}
        </div>
      )}

      {/* 加载中 */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-text-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {/* 空状态 */}
      {!loading && !error && sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle bg-bg-base py-16 text-text-muted">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
            <Upload size={28} className="text-accent" />
          </div>
          <p className="text-base font-medium text-text-primary">暂无企业资质</p>
          <p className="mb-5 mt-1 max-w-sm px-6 text-center text-sm text-text-secondary">
            首次采购前请先上传营业执照、药品经营许可证等资质文件，系统将在下单时自动使用。
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            <Upload size={16} /> 上传资质
          </button>
        </div>
      )}

      {/* 资质卡片网格 */}
      {!loading && sorted.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {sorted.map((q) => {
            const days = daysUntil(q.expiry_date)
            const isExpired = days < 0
            const isExpiring = days >= 0 && days <= 30
            const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(q.file_url)

            return (
              <div key={q.id} className="group flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-surface transition-shadow hover:shadow-md">
                {/* 缩略图 */}
                <a
                  href={q.file_url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block aspect-[4/3] w-full overflow-hidden bg-bg-base"
                >
                  {isImage ? (
                    <img
                      src={q.file_url}
                      alt={q.qualification_name}
                      className="h-full w-full object-contain transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-text-muted">
                      <FileText size={40} className="text-accent" />
                      <span className="text-xs">PDF 文件</span>
                    </div>
                  )}
                </a>

                {/* 信息 */}
                <div className="flex flex-1 flex-col p-3">
                  <h3 className="mb-1 truncate text-sm font-semibold text-text-primary" title={q.qualification_name}>
                    {q.qualification_name || q.qualification_type_display || '未命名资质'}
                  </h3>
                  <p className={`mb-2 text-xs ${isExpired ? 'text-text-muted line-through' : isExpiring ? 'text-orange-500' : 'text-text-secondary'}`}>
                    有效期至：{q.expiry_date ? formatDate(q.expiry_date) : '长期'}
                  </p>
                  <div className="mt-auto flex items-center gap-3">
                    <button
                      onClick={() => setEditingTarget(q)}
                      className="text-xs font-medium text-accent hover:text-accent-hover hover:underline"
                    >
                      更新
                    </button>
                    <button
                      onClick={() => setDeleteTarget(q)}
                      className="text-xs font-medium text-text-muted hover:text-text-primary hover:underline"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      {(showModal || editingTarget) && (
        <QualificationModal
          initialData={editingTarget}
          onClose={() => { setShowModal(false); setEditingTarget(null) }}
          onUploaded={() => { setShowModal(false); setEditingTarget(null); load() }}
          uploading={uploading}
          setUploading={setUploading}
        />
      )}

      {/* 删除确认 */}
      {deleteTarget && (
        <DeleteConfirmModal
          target={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); load() }}
        />
      )}
    </div>
  )
})

// ============================================================
// 统计卡片
// ============================================================
function StatCard({ label, value, color, icon: Icon }: {
  label: string
  value: number
  color: 'green' | 'orange' | 'gray'
  icon: typeof CheckCircle
}) {
  const colorMap = {
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    gray: 'bg-gray-100 dark:bg-gray-800 text-text-secondary dark:text-text-muted',
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-surface p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorMap[color]}`}>
        <Icon size={18} />
      </div>
      <div>
        <div className="text-xl font-bold text-text-primary">{value}</div>
        <div className="text-xs text-text-muted">{label}</div>
      </div>
    </div>
  )
}

// ============================================================
// 新建/编辑资质弹窗
// ============================================================
function QualificationModal({ initialData, onClose, onUploaded, uploading, setUploading }: {
  initialData: TenantQualification | null
  onClose: () => void
  onUploaded: () => void
  uploading: boolean
  setUploading: (v: boolean) => void
}) {
  const api = getApiClient()
  const isEdit = !!initialData
  const [form, setForm] = useState({
    qualification_type: initialData?.qualification_type || 'business_license',
    qualification_name: initialData?.qualification_name || '',
    license_number: initialData?.license_number || '',
    expiry_date: initialData?.expiry_date || '',
  })
  const [fileUrl, setFileUrl] = useState(initialData?.file_url || '')
  const [fileName, setFileName] = useState(initialData?.file_name || '')
  const [fileSize, setFileSize] = useState(initialData?.file_size || 0)
  const [error, setError] = useState('')

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const resp = await api.upload(file, form.qualification_type)
      if (resp.code === API_BUSINESS_CODE.SUCCESS && resp.data?.url) {
        setFileUrl(resp.data.url)
        setFileName(resp.data.name || file.name)
        setFileSize(resp.data.size || file.size)
        // 默认使用资质类型名称，租户可手动修改
        const defaultName = QUAL_TYPES.find(t => t.value === form.qualification_type)?.label || ''
        const ocr = resp.data.ocr || {}
        setForm(prev => ({
          ...prev,
          qualification_name: defaultName || prev.qualification_name,
          license_number: ocr.license_number || prev.license_number,
          expiry_date: ocr.expiry_date || '',
        }))
      } else {
        setError(resp.msg || '文件上传失败')
      }
    } catch {
      setError('文件上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.qualification_name.trim()) { setError('请填写资质名称'); return }
    if (!fileUrl) { setError('请上传资质文件'); return }
    setUploading(true)
    setError('')
    try {
      const expiryValue = form.expiry_date.trim()
      const payload = {
        ...form,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        expiry_date: expiryValue === '' || expiryValue === '长期' ? null : expiryValue,
      }
      const resp = isEdit
        ? await api.pdb.updateTenantQualification(initialData!.id, payload)
        : await api.pdb.createTenantQualification(payload)
      if (resp.code === API_BUSINESS_CODE.SUCCESS) {
        onUploaded()
      } else {
        setError(resp.msg || '保存失败')
      }
    } catch {
      setError('保存失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-bg-surface p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">{isEdit ? '更新企业资质' : '上传企业资质'}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><XCircle size={18} /></button>
        </div>

        {error && <div className="mb-3 rounded-lg border border-border-subtle bg-bg-hover px-3 py-2 text-xs text-text-secondary">{error}</div>}

        <div className="space-y-3">
          {/* 文件上传 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">资质文件 *</label>
            {fileUrl ? (
              <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-base px-3 py-2">
                <FileText size={16} className="text-accent" />
                <span className="flex-1 truncate text-sm text-text-primary">{fileName}</span>
                <button onClick={() => { setFileUrl(''); setFileName('') }} className="text-xs text-text-muted hover:text-text-primary">移除</button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-strong bg-bg-base px-3 py-6 text-sm text-text-muted hover:border-accent hover:text-accent">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploading ? '上传中...' : '点击选择文件'}
                <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,.pdf" />
              </label>
            )}
          </div>

          {/* 资质类型 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">资质类型 *</label>
            <select
              value={form.qualification_type}
              onChange={e => setForm(prev => ({ ...prev, qualification_type: e.target.value }))}
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            >
              {QUAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* 资质名称 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">资质名称 *</label>
            <input
              type="text"
              value={form.qualification_name}
              onChange={e => setForm(prev => ({ ...prev, qualification_name: e.target.value }))}
              placeholder="如：营业执照副本"
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>

          {/* 证书编号 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">证书编号</label>
            <input
              type="text"
              value={form.license_number}
              onChange={e => setForm(prev => ({ ...prev, license_number: e.target.value }))}
              placeholder="证件编号"
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>

          {/* 有效期至 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">有效期至</label>
            <input
              type="text"
              value={form.expiry_date}
              onChange={e => setForm(prev => ({ ...prev, expiry_date: e.target.value }))}
              placeholder="如 2026-07-30 或 长期"
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
            <p className="mt-1 text-xs text-text-muted">未识别到有效期时默认显示为“长期”，可手动修改</p>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover">取消</button>
          <button
            onClick={handleSubmit}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 删除确认弹窗
// ============================================================
function DeleteConfirmModal({ target, onCancel, onDeleted }: {
  target: TenantQualification
  onCancel: () => void
  onDeleted: () => void
}) {
  const api = getApiClient()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const resp = await api.pdb.deleteTenantQualification(target.id)
      if (resp.code === API_BUSINESS_CODE.SUCCESS) {
        onDeleted()
      } else {
        setError(resp.msg || '删除失败')
      }
    } catch {
      setError('删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-bg-surface p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <AlertTriangle className="h-5 w-5 text-text-secondary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">确认删除</h3>
            <p className="text-xs text-text-muted">删除后不可恢复</p>
          </div>
        </div>
        <p className="mb-4 text-sm text-text-secondary">
          确定要删除资质「{target.qualification_name}」吗？
        </p>
        {error && <div className="mb-3 rounded-lg border border-border-subtle bg-bg-hover px-3 py-2 text-xs text-text-secondary">{error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover">取消</button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-lg bg-text-muted px-4 py-2 text-sm font-medium text-white hover:bg-text-secondary disabled:opacity-50"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            删除
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Tab 2: 首营交换记录
// ============================================================
export const FirstOpsTab = forwardRef<FirstOpsTabHandle>(function FirstOpsTab(_props, ref) {
  const api = getApiClient()
  const [records, setRecords] = useState<FirstOperationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailRecord, setDetailRecord] = useState<FirstOperationRecord | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const formatApiError = (msg: string) => {
    if (msg.includes('tenant_id')) return '未识别到租户信息，请重新登录或联系管理员'
    return msg
  }

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    api.pdb.firstOperations()
      .then((resp) => {
        if (resp.code === API_BUSINESS_CODE.SUCCESS && resp.data) {
          setRecords(resp.data as FirstOperationRecord[])
        } else {
          setRecords([])
          if (resp.msg && !resp.msg.includes('Not Found')) setError(formatApiError(resp.msg))
        }
      })
      .catch(() => setError('加载首营记录失败'))
      .finally(() => setLoading(false))
  }, [api])

  useImperativeHandle(ref, () => ({
    refresh: load,
  }))

  useEffect(() => { load() }, [load])

  const handleAction = async (id: number, action: () => Promise<{ code: number; msg: string }>) => {
    setActionLoading(id)
    try {
      const resp = await action()
      if (resp.code === API_BUSINESS_CODE.SUCCESS) {
        load()
        if (detailRecord?.id === id) {
          const fresh = await api.pdb.firstOperationDetail(id)
          if (fresh.code === API_BUSINESS_CODE.SUCCESS && fresh.data) setDetailRecord(fresh.data as FirstOperationRecord)
        }
      } else {
        setError(resp.msg || '操作失败')
      }
    } catch {
      setError('操作失败，请重试')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div>
      {/* 错误提示 */}
      {error && (
        <div className="mb-4 rounded-lg border border-border-subtle bg-bg-hover px-4 py-3 text-sm text-text-secondary">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-xs underline">关闭</button>
        </div>
      )}

      {/* 加载中 */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-text-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {/* 空状态 */}
      {!loading && !error && records.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
          <FileCheck2 size={48} className="mb-3 opacity-30" />
          <p className="text-sm">暂无首营交换记录</p>
          <p className="mt-1 max-w-md px-6 text-center text-xs text-text-muted">
            系统会在您向新供应商采购时自动检测：若已开户且存在有效交换记录则自动同步；仅在未交换或证件过期时提示您发起交换。
          </p>
        </div>
      )}

      {/* 记录列表 */}
      {!loading && records.length > 0 && (
        <div className="space-y-3">
          {records.map((rec) => {
            const style = FO_STATUS_STYLES[rec.status] || FO_STATUS_STYLES.draft
            const currentStep = FO_STATUS_FLOW.indexOf(rec.status)
            const isLoading = actionLoading === rec.id

            return (
              <div key={rec.id} className="rounded-xl border border-border-subtle bg-bg-surface p-5">
                {/* 头部 */}
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
                      <Building2 className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-text-primary">{rec.record_number}</span>
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
                          {rec.status_display || FO_STATUS_LABELS[rec.status] || rec.status}
                        </span>
                        {rec.is_valid && (
                          <span className="inline-flex items-center gap-1 rounded bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                            <CheckCircle size={10} /> 有效
                          </span>
                        )}
                        {rec.external_reused && (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400" title={`复用来源: ${rec.external_source}`}>
                            <Shield size={10} /> 外部复用
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-text-muted">
                        供应商：{rec.seller_supplier_name || '—'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDetailRecord(rec)}
                    className="flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    <Eye size={14} /> 详情
                  </button>
                </div>

                {/* 状态流程 */}
                {rec.status !== 'rejected' && rec.status !== 'expired' && (
                  <div className="mb-3 flex items-center gap-1">
                    {FO_STATUS_FLOW.map((step, idx) => {
                      const isActive = idx <= currentStep
                      const isCurrent = idx === currentStep
                      return (
                        <div key={step} className="flex items-center">
                          {idx > 0 && <div className={`h-0.5 w-6 ${isActive ? 'bg-accent' : 'bg-border-subtle'}`} />}
                          <div className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs ${
                            isCurrent ? 'bg-accent-soft text-accent font-medium' : isActive ? 'text-text-secondary' : 'text-text-muted'
                          }`}>
                            {isActive && <CheckCircle size={10} />}
                            {FO_STATUS_LABELS[step]}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* 双方确认状态 */}
                <div className="mb-3 flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    {rec.buyer_confirmed ? (
                      <><CheckCircle size={12} className="text-green-500" /> <span className="text-text-secondary">买方已确认</span></>
                    ) : (
                      <><Clock size={12} className="text-text-muted" /> <span className="text-text-muted">买方待确认</span></>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {rec.seller_confirmed ? (
                      <><CheckCircle size={12} className="text-green-500" /> <span className="text-text-secondary">卖方已确认</span></>
                    ) : (
                      <><Clock size={12} className="text-text-muted" /> <span className="text-text-muted">卖方待确认</span></>
                    )}
                  </div>
                  {rec.valid_until && (
                    <div className="ml-auto text-text-muted">
                      有效期至：{formatDate(rec.valid_until)}
                      {rec.is_valid && (() => {
                        const d = daysUntil(rec.valid_until)
                        return d <= 30 ? <span className="ml-1 text-orange-500">（{d}天后到期）</span> : null
                      })()}
                    </div>
                  )}
                </div>

                {/* 拒绝原因 */}
                {rec.status === 'rejected' && (rec.buyer_remark || rec.seller_remark) && (
                  <div className="mb-3 rounded-lg bg-bg-hover px-3 py-2 text-xs text-text-secondary">
                    拒绝原因：{rec.buyer_remark || rec.seller_remark}
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex items-center gap-2 border-t border-border-subtle pt-3">
                  {/* draft → 提交 */}
                  {rec.status === 'draft' && (
                    <button
                      onClick={() => handleAction(rec.id, () => api.pdb.submitFirstOperation(rec.id))}
                      disabled={isLoading}
                      className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}
                      提交交换
                    </button>
                  )}

                  {/* exchanged → 买方确认/拒绝 */}
                  {rec.status === 'exchanged' && !rec.buyer_confirmed && (
                    <>
                      <button
                        onClick={() => handleAction(rec.id, () => api.pdb.confirmFirstOperation(rec.id, {}))}
                        disabled={isLoading}
                        className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                      >
                        {isLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                        确认资质
                      </button>
                      <button
                        onClick={() => {
                          const remark = window.prompt('请输入拒绝原因')
                          if (remark !== null) handleAction(rec.id, () => api.pdb.rejectFirstOperation(rec.id, { remark }))
                        }}
                        disabled={isLoading}
                        className="flex items-center gap-1 rounded-lg border border-border-strong px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover disabled:opacity-50"
                      >
                        <XCircle size={12} /> 拒绝
                      </button>
                    </>
                  )}

                  {/* 双方确认 → 发起签章 */}
                  {rec.status === 'exchanged' && rec.buyer_confirmed && rec.seller_confirmed && !rec.e_signature_contract_id && (
                    <button
                      onClick={() => handleAction(rec.id, () => api.pdb.esignFirstOperation(rec.id))}
                      disabled={isLoading}
                      className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 size={12} className="animate-spin" /> : <PenTool size={12} />}
                      发起签章
                    </button>
                  )}

                  {/* signing → 查看签章状态 */}
                  {rec.status === 'signing' && (
                    <button
                      onClick={() => handleAction(rec.id, () => api.pdb.checkEsignStatus(rec.id))}
                      disabled={isLoading}
                      className="flex items-center gap-1 rounded-lg border border-border-strong px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      刷新签章状态
                    </button>
                  )}

                  {/* signing → 模拟签章完成（开发测试用） */}
                  {rec.status === 'signing' && (
                    <button
                      onClick={() => handleAction(rec.id, () => api.pdb.mockSignFirstOperation(rec.id))}
                      disabled={isLoading}
                      className="flex items-center gap-1 rounded-lg border border-purple-300 px-3 py-1.5 text-xs font-medium text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50"
                    >
                      <PenTool size={12} /> 模拟完成签章
                    </button>
                  )}

                  {/* signed → 查看合同 */}
                  {rec.status === 'signed' && rec.e_signature_contract_url && (
                    <a
                      href={rec.e_signature_contract_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-lg border border-border-strong px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent-soft"
                    >
                      <Eye size={12} /> 查看合同
                    </a>
                  )}

                  {/* 签章中提示 */}
                  {rec.status === 'signing' && rec.e_signature_contract_id && (
                    <span className="text-xs text-text-muted">合同ID: {rec.e_signature_contract_id}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 详情弹窗 */}
      {detailRecord && (
        <FirstOpDetailModal
          record={detailRecord}
          onClose={() => setDetailRecord(null)}
        />
      )}
    </div>
  )
})

// ============================================================
// 首营详情弹窗
// ============================================================
function FirstOpDetailModal({ record, onClose }: {
  record: FirstOperationRecord
  onClose: () => void
}) {
  const buyerQuals = Array.isArray(record.buyer_qualifications) ? record.buyer_qualifications : []
  const sellerQuals = Array.isArray(record.seller_qualifications) ? record.seller_qualifications : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-bg-surface p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">交换记录详情</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><XCircle size={18} /></button>
        </div>

        {/* 基本信息 */}
        <div className="mb-5 grid grid-cols-2 gap-3">
          <InfoItem label="记录编号" value={record.record_number} />
          <InfoItem label="状态" value={record.status_display || FO_STATUS_LABELS[record.status]} />
          <InfoItem label="买方" value={record.buyer_tenant_name} />
          <InfoItem label="卖方" value={record.seller_supplier_name} />
          <InfoItem label="有效期起" value={formatDate(record.valid_from)} />
          <InfoItem label="有效期至" value={formatDate(record.valid_until)} />
          <InfoItem label="创建时间" value={formatDate(record.created_at)} />
          <InfoItem label="签章服务" value={record.e_signature_service || '—'} />
          {record.external_reused && (
            <>
              <InfoItem label="复用来源" value={record.external_source || '供应商API'} />
              <InfoItem label="复用方式" value="外部复用（无需重复交换）" />
            </>
          )}
        </div>

        {/* 双方确认 */}
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className={`rounded-lg border p-3 ${record.buyer_confirmed ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-border-subtle'}`}>
            <div className="mb-1 flex items-center gap-1 text-xs font-medium text-text-secondary">
              {record.buyer_confirmed ? <CheckCircle size={12} className="text-green-500" /> : <Clock size={12} className="text-text-muted" />}
              买方确认
            </div>
            <div className="text-xs text-text-muted">
              {record.buyer_confirmed ? `已确认 · ${formatDate(record.buyer_confirmed_at)}` : '待确认'}
              {record.buyer_remark && <div className="mt-1">备注：{record.buyer_remark}</div>}
            </div>
          </div>
          <div className={`rounded-lg border p-3 ${record.seller_confirmed ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-border-subtle'}`}>
            <div className="mb-1 flex items-center gap-1 text-xs font-medium text-text-secondary">
              {record.seller_confirmed ? <CheckCircle size={12} className="text-green-500" /> : <Clock size={12} className="text-text-muted" />}
              卖方确认
            </div>
            <div className="text-xs text-text-muted">
              {record.seller_confirmed ? `已确认 · ${formatDate(record.seller_confirmed_at)}` : '待确认'}
              {record.seller_remark && <div className="mt-1">备注：{record.seller_remark}</div>}
            </div>
          </div>
        </div>

        {/* 买方资质快照 */}
        <div className="mb-4">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">买方资质（{buyerQuals.length}）</h3>
          {buyerQuals.length === 0 ? (
            <p className="text-xs text-text-muted">无资质信息</p>
          ) : (
            <div className="space-y-1">
              {buyerQuals.map((q, idx) => {
                const item = q as Record<string, unknown>
                return (
                  <div key={idx} className="flex items-center gap-2 rounded border border-border-subtle px-3 py-1.5 text-xs">
                    <FileText size={12} className="text-accent" />
                    <span className="text-text-primary">{String(item.qualification_name || item.name || '—')}</span>
                    <span className="text-text-muted">{String(item.qualification_type_display || item.qualification_type || '')}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 卖方资质快照 */}
        <div className="mb-4">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">卖方资质（{sellerQuals.length}）</h3>
          {sellerQuals.length === 0 ? (
            <p className="text-xs text-text-muted">无资质信息</p>
          ) : (
            <div className="space-y-1">
              {sellerQuals.map((q, idx) => {
                const item = q as Record<string, unknown>
                return (
                  <div key={idx} className="flex items-center gap-2 rounded border border-border-subtle px-3 py-1.5 text-xs">
                    <FileText size={12} className="text-accent" />
                    <span className="text-text-primary">{String(item.qualification_name || item.name || '—')}</span>
                    <span className="text-text-muted">{String(item.qualification_type_display || item.qualification_type || '')}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 备注 */}
        {record.notes && (
          <div className="mb-4">
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-text-muted">备注</h3>
            <p className="text-sm text-text-secondary">{record.notes}</p>
          </div>
        )}

        {/* 合同链接 */}
        {record.e_signature_contract_url && (
          <div className="flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2">
            <FileCheck2 size={16} className="text-accent" />
            <a href={record.e_signature_contract_url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">
              查看已签合同
            </a>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover">关闭</button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 信息项
// ============================================================
function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-text-muted">{label}</div>
      <div className="text-sm text-text-primary">{value}</div>
    </div>
  )
}

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Tag,
  Users,
  Zap,
  Plus,
  X,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  Search,
  Loader2,
  Check,
  Play,
} from 'lucide-react'
import { getApiClient } from '../lib/api'
import { API_BUSINESS_CODE } from '../lib/constants'
import type {
  WecomDevice,
  WecomContact,
  WecomGroupRoom,
  WecomTag,
  WecomTagGroup,
  AutoTagRule,
} from '../types'

// ============================================================
// 常量
// ============================================================

const TAG_COLORS = [
  { key: 'blue', label: '蓝色', value: '#3b82f6' },
  { key: 'green', label: '绿色', value: '#22c55e' },
  { key: 'yellow', label: '黄色', value: '#eab308' },
  { key: 'orange', label: '橙色', value: '#f97316' },
  { key: 'red', label: '红色', value: '#ef4444' },
  { key: 'purple', label: '紫色', value: '#a855f7' },
  { key: 'pink', label: '粉色', value: '#ec4899' },
  { key: 'cyan', label: '青色', value: '#06b6d4' },
]

type SubTabKey = 'tagManagement' | 'autoTagRules' | 'groupTagManagement'

const SUB_TABS: Array<{ key: SubTabKey; label: string; icon: typeof Tag }> = [
  { key: 'tagManagement', label: '标签管理', icon: Tag },
  { key: 'autoTagRules', label: '自动贴标签规则', icon: Zap },
  { key: 'groupTagManagement', label: '群分组管理', icon: Users },
]

// ============================================================
// 主组件
// ============================================================

export default function TagsTab() {
  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>('tagManagement')

  return (
    <div className="flex h-full flex-col">
      {/* 子导航 */}
      <div className="flex gap-1 border-b border-border-subtle px-6 py-3">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeSubTab === tab.key
                ? 'bg-accent/10 text-accent'
                : 'text-text-secondary hover:bg-bg-hover'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-hidden">
        {activeSubTab === 'tagManagement' && <TagManagementPage />}
        {activeSubTab === 'autoTagRules' && <AutoTagRulesPage />}
        {activeSubTab === 'groupTagManagement' && <GroupTagManagementPage />}
      </div>
    </div>
  )
}

// ============================================================
// 共享：设备选择栏
// ============================================================

function useDevices() {
  const api = getApiClient()
  const [devices, setDevices] = useState<WecomDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await api.wecom.devices.list()
        if (res.code === API_BUSINESS_CODE.SUCCESS && Array.isArray(res.data)) {
          const list = res.data as WecomDevice[]
          setDevices(list)
          if (list.length > 0) setSelectedDeviceId(list[0].id)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [api])

  return { devices, selectedDeviceId, setSelectedDeviceId, loading }
}

function DeviceSidebar({
  devices,
  selectedDeviceId,
  onSelect,
  loading,
}: {
  devices: WecomDevice[]
  selectedDeviceId: number | null
  onSelect: (id: number) => void
  loading: boolean
}) {
  return (
    <div className="flex w-48 flex-col border-r border-border-subtle bg-bg-sidebar">
      <div className="px-4 py-3 text-xs font-medium text-text-muted">微信账号</div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
        </div>
      ) : devices.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-text-muted">暂无设备</div>
      ) : (
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {devices.map((device) => (
            <button
              key={device.id}
              onClick={() => onSelect(device.id)}
              className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                selectedDeviceId === device.id
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:bg-bg-hover'
              }`}
            >
              {device.avatar ? (
                <img src={device.avatar} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-medium text-accent">
                  {device.name?.charAt(0) || '?'}
                </div>
              )}
              <span className="truncate">{device.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// 标签管理页面
// ============================================================

function TagManagementPage() {
  const api = getApiClient()
  const { devices, selectedDeviceId, setSelectedDeviceId, loading: devicesLoading } = useDevices()

  const [groups, setGroups] = useState<WecomTagGroup[]>([])
  const [tags, setTags] = useState<WecomTag[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set())
  const [showUntagged, setShowUntagged] = useState(false)
  const [tagsLoading, setTagsLoading] = useState(false)

  // 联系人列表
  const [contacts, setContacts] = useState<WecomContact[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactSearch, setContactSearch] = useState('')
  const [editingContactTags, setEditingContactTags] = useState<number | null>(null)

  // 新建标签/分组弹窗
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showCreateTag, setShowCreateTag] = useState(false)
  const [createTagGroupId, setCreateTagGroupId] = useState<number | null>(null)

  // 编辑分组
  const [editingGroup, setEditingGroup] = useState<WecomTagGroup | null>(null)

  // 加载标签分组和标签
  const loadTagsData = useCallback(async (deviceId: number) => {
    setTagsLoading(true)
    try {
      const [groupsRes, tagsRes] = await Promise.all([
        api.wecom.tagGroups.list({ device_id: deviceId }),
        api.wecom.tags.list({ device_id: deviceId }),
      ])
      if (groupsRes.code === API_BUSINESS_CODE.SUCCESS && Array.isArray(groupsRes.data)) {
        setGroups(groupsRes.data as WecomTagGroup[])
        // 默认展开所有分组
        setExpandedGroups(new Set((groupsRes.data as WecomTagGroup[]).map((g) => g.id)))
      }
      if (tagsRes.code === API_BUSINESS_CODE.SUCCESS && Array.isArray(tagsRes.data)) {
        setTags(tagsRes.data as WecomTag[])
      }
    } catch {
      // ignore
    } finally {
      setTagsLoading(false)
    }
  }, [api])

  useEffect(() => {
    if (selectedDeviceId !== null) {
      loadTagsData(selectedDeviceId)
      setSelectedTagIds(new Set())
      setShowUntagged(false)
    }
  }, [selectedDeviceId, loadTagsData])

  // 加载联系人
  const loadContacts = useCallback(async () => {
    if (selectedDeviceId === null) return
    setContactsLoading(true)
    try {
      const params: Record<string, unknown> = {
        device_id: selectedDeviceId,
        page: 1,
        page_size: 200,
      }
      if (showUntagged) {
        params.untagged = true
      } else if (selectedTagIds.size > 0) {
        params.tag_ids = Array.from(selectedTagIds).join(',')
      }
      if (contactSearch) {
        params.search = contactSearch
      }
      const res = await api.wecom.contacts.list(params)
      if (res.code === API_BUSINESS_CODE.SUCCESS && res.data) {
        const data = res.data as { list: unknown[] }
        setContacts((data.list as WecomContact[]) || [])
      }
    } catch {
      // ignore
    } finally {
      setContactsLoading(false)
    }
  }, [api, selectedDeviceId, selectedTagIds, showUntagged, contactSearch])

  useEffect(() => {
    const timer = setTimeout(loadContacts, 300)
    return () => clearTimeout(timer)
  }, [loadContacts])

  const toggleGroup = (groupId: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev)
      if (next.has(tagId)) next.delete(tagId)
      else next.add(tagId)
      return next
    })
    setShowUntagged(false)
  }

  // 分组下的标签
  const tagsByGroup = useMemo(() => {
    const map = new Map<number, WecomTag[]>()
    for (const tag of tags) {
      const gid = tag.group || 0
      if (!map.has(gid)) map.set(gid, [])
      map.get(gid)!.push(tag)
    }
    return map
  }, [tags])

  // 未分组标签
  const ungroupedTags = useMemo(() => tags.filter((t) => !t.group), [tags])

  // 删除分组
  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('删除分组后，组内标签将变为未分组。确认删除？')) return
    try {
      await api.wecom.tagGroups.delete(groupId)
      if (selectedDeviceId !== null) loadTagsData(selectedDeviceId)
    } catch {
      // ignore
    }
  }

  // 删除标签
  const handleDeleteTag = async (tagId: number) => {
    if (!confirm('删除标签后，已打此标签的联系人/群聊将移除该标签。确认删除？')) return
    try {
      await api.wecom.tags.delete(tagId)
      if (selectedDeviceId !== null) loadTagsData(selectedDeviceId)
    } catch {
      // ignore
    }
  }

  // 更新联系人标签
  const handleUpdateContactTags = async (contactId: number, tagIds: number[]) => {
    try {
      await api.wecom.contactTags.update(contactId, tagIds)
      setEditingContactTags(null)
      loadContacts()
      if (selectedDeviceId !== null) loadTagsData(selectedDeviceId)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex h-full">
      {/* 左栏：设备选择 */}
      <DeviceSidebar
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        onSelect={setSelectedDeviceId}
        loading={devicesLoading}
      />

      {/* 中栏：标签分组树 */}
      <div className="flex w-64 flex-col border-r border-border-subtle">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium">标签分组</span>
          <div className="flex gap-1">
            <button
              onClick={() => { setEditingGroup(null); setShowCreateGroup(true) }}
              className="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-accent"
              title="新建分组"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setCreateTagGroupId(null); setShowCreateTag(true) }}
              className="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-accent"
              title="新建标签"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 全部/未标签筛选 */}
        <div className="px-2 pb-2">
          <button
            onClick={() => { setSelectedTagIds(new Set()); setShowUntagged(false) }}
            className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              !showUntagged && selectedTagIds.size === 0
                ? 'bg-accent/10 text-accent'
                : 'text-text-secondary hover:bg-bg-hover'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            全部好友
          </button>
          <button
            onClick={() => { setSelectedTagIds(new Set()); setShowUntagged(true) }}
            className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              showUntagged
                ? 'bg-accent/10 text-accent'
                : 'text-text-secondary hover:bg-bg-hover'
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            未打标签
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {tagsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
            </div>
          ) : groups.length === 0 && ungroupedTags.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-text-muted">
              暂无标签<br />点击右上角创建
            </div>
          ) : (
            <>
              {/* 分组列表 */}
              {groups.map((group) => (
                <div key={group.id} className="mb-1">
                  <div className="group flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-bg-hover">
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className="flex flex-1 items-center gap-1 text-sm text-text-primary"
                    >
                      {expandedGroups.has(group.id) ? (
                        <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
                      )}
                      <span className="truncate font-medium">{group.name}</span>
                      <span className="text-xs text-text-muted">({group.tag_count})</span>
                    </button>
                    <div className="hidden items-center gap-0.5 group-hover:flex">
                      <button
                        onClick={() => { setCreateTagGroupId(group.id); setShowCreateTag(true) }}
                        className="rounded p-0.5 text-text-muted hover:text-accent"
                        title="添加标签"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => { setEditingGroup(group); setShowCreateGroup(true) }}
                        className="rounded p-0.5 text-text-muted hover:text-accent"
                        title="编辑分组"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="rounded p-0.5 text-text-muted hover:text-red-500"
                        title="删除分组"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  {expandedGroups.has(group.id) && (
                    <div className="ml-5 border-l border-border-subtle pl-1">
                      {(tagsByGroup.get(group.id) || []).map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => toggleTag(tag.id)}
                          className={`group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                            selectedTagIds.has(tag.id)
                              ? 'bg-accent/10 text-accent'
                              : 'text-text-secondary hover:bg-bg-hover'
                          }`}
                        >
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: tag.color || '#6b7280' }}
                          />
                          <span className="flex-1 truncate text-left">{tag.name}</span>
                          <span className="text-xs text-text-muted">{tag.contact_count}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteTag(tag.id) }}
                            className="hidden rounded p-0.5 text-text-muted hover:text-red-500 group-hover:block"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </button>
                      ))}
                      {(tagsByGroup.get(group.id) || []).length === 0 && (
                        <div className="px-2 py-1 text-xs text-text-muted">暂无标签</div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* 未分组标签 */}
              {ungroupedTags.length > 0 && (
                <div className="mb-1">
                  <div className="flex items-center gap-1 rounded-lg px-2 py-1.5">
                    <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
                    <span className="text-sm font-medium text-text-primary">未分组</span>
                    <span className="text-xs text-text-muted">({ungroupedTags.length})</span>
                  </div>
                  <div className="ml-5 border-l border-border-subtle pl-1">
                    {ungroupedTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={`group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                          selectedTagIds.has(tag.id)
                            ? 'bg-accent/10 text-accent'
                            : 'text-text-secondary hover:bg-bg-hover'
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: tag.color || '#6b7280' }}
                        />
                        <span className="flex-1 truncate text-left">{tag.name}</span>
                        <span className="text-xs text-text-muted">{tag.contact_count}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteTag(tag.id) }}
                          className="hidden rounded p-0.5 text-text-muted hover:text-red-500 group-hover:block"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 右栏：联系人列表 */}
      <div className="flex flex-1 flex-col">
        {/* 搜索栏 */}
        <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder="搜索好友名称或备注"
              className="w-full rounded-lg border border-border-subtle bg-bg-input py-1.5 pl-8 pr-3 text-sm outline-none focus:border-accent"
            />
          </div>
          {selectedTagIds.size > 0 && (
            <div className="flex items-center gap-1 text-xs text-accent">
              <Tag className="h-3 w-3" />
              {selectedTagIds.size} 个标签筛选
              <button onClick={() => setSelectedTagIds(new Set())} className="ml-1 hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* 联系人列表 */}
        <div className="flex-1 overflow-y-auto">
          {contactsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-text-muted">
              <Users className="mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">暂无好友</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="group flex items-center gap-3 px-4 py-2.5 hover:bg-bg-hover"
                >
                  {contact.avatar ? (
                    <img src={contact.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-medium text-accent">
                      {contact.name?.charAt(0) || '?'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{contact.remark || contact.name}</span>
                      {contact.ai_hosted && (
                        <span className="rounded bg-accent/10 px-1 py-0.5 text-xs text-accent">AI托管</span>
                      )}
                    </div>
                    {contact.tags_display && contact.tags_display.length > 0 ? (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {contact.tags_display.map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded px-1.5 py-0.5 text-xs"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color,
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted">未打标签</span>
                    )}
                  </div>
                  <button
                    onClick={() => setEditingContactTags(contact.id)}
                    className="hidden rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent group-hover:block"
                    title="编辑标签"
                  >
                    <Tag className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部统计 */}
        <div className="border-t border-border-subtle px-4 py-2 text-xs text-text-muted">
          共 {contacts.length} 位好友
        </div>
      </div>

      {/* 弹窗：新建/编辑分组 */}
      {showCreateGroup && (
        <CreateGroupModal
          device={selectedDeviceId}
          editingGroup={editingGroup}
          onClose={() => { setShowCreateGroup(false); setEditingGroup(null) }}
          onSuccess={() => {
            setShowCreateGroup(false)
            setEditingGroup(null)
            if (selectedDeviceId !== null) loadTagsData(selectedDeviceId)
          }}
        />
      )}

      {/* 弹窗：新建标签 */}
      {showCreateTag && (
        <CreateTagModal
          device={selectedDeviceId}
          groupId={createTagGroupId}
          groups={groups}
          onClose={() => { setShowCreateTag(false); setCreateTagGroupId(null) }}
          onSuccess={() => {
            setShowCreateTag(false)
            setCreateTagGroupId(null)
            if (selectedDeviceId !== null) loadTagsData(selectedDeviceId)
          }}
        />
      )}

      {/* 弹窗：编辑联系人标签 */}
      {editingContactTags !== null && (
        <EditContactTagsModal
          contactId={editingContactTags}
          allTags={tags}
          groups={groups}
          currentTagIds={contacts.find((c) => c.id === editingContactTags)?.tags || []}
          onClose={() => setEditingContactTags(null)}
          onSave={handleUpdateContactTags}
        />
      )}
    </div>
  )
}

// ============================================================
// 自动贴标签规则页面
// ============================================================

function AutoTagRulesPage() {
  const api = getApiClient()
  const { devices, selectedDeviceId, setSelectedDeviceId, loading: devicesLoading } = useDevices()

  const [rules, setRules] = useState<AutoTagRule[]>([])
  const [tags, setTags] = useState<WecomTag[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editingRule, setEditingRule] = useState<AutoTagRule | null>(null)
  const [running, setRunning] = useState<number | null>(null)

  const loadData = useCallback(async (deviceId: number) => {
    setLoading(true)
    try {
      const [rulesRes, tagsRes] = await Promise.all([
        api.marketing.autoTagRules.list({ device_id: deviceId }),
        api.wecom.tags.list({ device_id: deviceId }),
      ])
      if (rulesRes.code === API_BUSINESS_CODE.SUCCESS && Array.isArray(rulesRes.data)) {
        setRules(rulesRes.data as AutoTagRule[])
      }
      if (tagsRes.code === API_BUSINESS_CODE.SUCCESS && Array.isArray(tagsRes.data)) {
        setTags(tagsRes.data as WecomTag[])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    if (selectedDeviceId !== null) loadData(selectedDeviceId)
  }, [selectedDeviceId, loadData])

  const handleToggle = async (rule: AutoTagRule) => {
    try {
      await api.marketing.autoTagRules.update(rule.id, { is_enabled: !rule.is_enabled })
      if (selectedDeviceId !== null) loadData(selectedDeviceId)
    } catch {
      // ignore
    }
  }

  const handleDelete = async (ruleId: number) => {
    if (!confirm('确认删除此规则？')) return
    try {
      await api.marketing.autoTagRules.delete(ruleId)
      if (selectedDeviceId !== null) loadData(selectedDeviceId)
    } catch {
      // ignore
    }
  }

  const handleRun = async (ruleId: number) => {
    setRunning(ruleId)
    try {
      const res = await api.marketing.autoTagRules.run(ruleId)
      if (res.code === API_BUSINESS_CODE.SUCCESS) {
        alert(`执行完成！${(res.data as { message?: string })?.message || '已处理匹配的联系人/群聊'}`)
        if (selectedDeviceId !== null) loadData(selectedDeviceId)
      } else {
        alert(res.msg || '执行失败')
      }
    } catch {
      alert('执行失败，请稍后重试')
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="flex h-full">
      {/* 左栏：设备选择 */}
      <DeviceSidebar
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        onSelect={setSelectedDeviceId}
        loading={devicesLoading}
      />

      {/* 右侧：规则列表 */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <span className="text-sm font-medium">自动贴标签规则</span>
          <button
            onClick={() => { setEditingRule(null); setShowCreate(true) }}
            disabled={selectedDeviceId === null}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            新增规则
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
            </div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-text-muted">
              <Zap className="mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">暂无规则</p>
              <p className="mt-1 text-xs">创建规则后，系统将自动为匹配的好友/群聊打上标签</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-lg border border-border-subtle bg-bg-card p-4 transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{rule.name}</span>
                        <span
                          className="rounded px-1.5 py-0.5 text-xs"
                          style={{
                            backgroundColor: `${rule.target_tag_color}20`,
                            color: rule.target_tag_color,
                          }}
                        >
                          {rule.target_tag_name}
                        </span>
                        <span className="text-xs text-text-muted">
                          {rule.scope_display}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {rule.keywords.map((kw, idx) => (
                          <span
                            key={idx}
                            className="rounded bg-bg-hover px-2 py-0.5 text-xs text-text-secondary"
                          >
                            {kw}
                          </span>
                        ))}
                        <span className="ml-1 text-xs text-text-muted">
                          {rule.match_mode_display}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
                        <span>命中 {rule.hit_count} 次</span>
                        {rule.last_run_at && (
                          <span>最后执行: {new Date(rule.last_run_at).toLocaleString('zh-CN')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* 启用/停用开关 */}
                      <button
                        onClick={() => handleToggle(rule)}
                        className={`relative h-5 w-9 rounded-full transition-colors ${
                          rule.is_enabled ? 'bg-accent' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                            rule.is_enabled ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                      {/* 执行按钮 */}
                      <button
                        onClick={() => handleRun(rule.id)}
                        disabled={running === rule.id}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-accent hover:bg-accent/10 disabled:opacity-50"
                        title="手动执行"
                      >
                        {running === rule.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        执行
                      </button>
                      {/* 编辑 */}
                      <button
                        onClick={() => { setEditingRule(rule); setShowCreate(true) }}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent"
                        title="编辑"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {/* 删除 */}
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-red-500"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 弹窗：新建/编辑规则 */}
      {showCreate && (
        <CreateRuleModal
          device={selectedDeviceId}
          tags={tags}
          editingRule={editingRule}
          onClose={() => { setShowCreate(false); setEditingRule(null) }}
          onSuccess={() => {
            setShowCreate(false)
            setEditingRule(null)
            if (selectedDeviceId !== null) loadData(selectedDeviceId)
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// 群分组管理页面
// ============================================================

function GroupTagManagementPage() {
  const api = getApiClient()
  const { devices, selectedDeviceId, setSelectedDeviceId, loading: devicesLoading } = useDevices()

  const [groups, setGroups] = useState<WecomTagGroup[]>([])
  const [tags, setTags] = useState<WecomTag[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set())
  const [showUntagged, setShowUntagged] = useState(false)
  const [tagsLoading, setTagsLoading] = useState(false)

  // 群聊列表
  const [rooms, setRooms] = useState<WecomGroupRoom[]>([])
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [roomSearch, setRoomSearch] = useState('')
  const [editingRoomTags, setEditingRoomTags] = useState<number | null>(null)

  // 新建标签/分组弹窗
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showCreateTag, setShowCreateTag] = useState(false)
  const [createTagGroupId, setCreateTagGroupId] = useState<number | null>(null)
  const [editingGroup, setEditingGroup] = useState<WecomTagGroup | null>(null)

  const loadTagsData = useCallback(async (deviceId: number) => {
    setTagsLoading(true)
    try {
      const [groupsRes, tagsRes] = await Promise.all([
        api.wecom.tagGroups.list({ device_id: deviceId }),
        api.wecom.tags.list({ device_id: deviceId }),
      ])
      if (groupsRes.code === API_BUSINESS_CODE.SUCCESS && Array.isArray(groupsRes.data)) {
        setGroups(groupsRes.data as WecomTagGroup[])
        setExpandedGroups(new Set((groupsRes.data as WecomTagGroup[]).map((g) => g.id)))
      }
      if (tagsRes.code === API_BUSINESS_CODE.SUCCESS && Array.isArray(tagsRes.data)) {
        setTags(tagsRes.data as WecomTag[])
      }
    } catch {
      // ignore
    } finally {
      setTagsLoading(false)
    }
  }, [api])

  useEffect(() => {
    if (selectedDeviceId !== null) {
      loadTagsData(selectedDeviceId)
      setSelectedTagIds(new Set())
      setShowUntagged(false)
    }
  }, [selectedDeviceId, loadTagsData])

  const loadRooms = useCallback(async () => {
    if (selectedDeviceId === null) return
    setRoomsLoading(true)
    try {
      const params: Record<string, unknown> = { device_id: selectedDeviceId }
      if (showUntagged) {
        params.untagged = true
      } else if (selectedTagIds.size > 0) {
        params.tag_ids = Array.from(selectedTagIds).join(',')
      }
      if (roomSearch) {
        params.search = roomSearch
      }
      const res = await api.wecom.groups.list(params)
      if (res.code === API_BUSINESS_CODE.SUCCESS && Array.isArray(res.data)) {
        setRooms(res.data as WecomGroupRoom[])
      }
    } catch {
      // ignore
    } finally {
      setRoomsLoading(false)
    }
  }, [api, selectedDeviceId, selectedTagIds, showUntagged, roomSearch])

  useEffect(() => {
    const timer = setTimeout(loadRooms, 300)
    return () => clearTimeout(timer)
  }, [loadRooms])

  const toggleGroup = (groupId: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev)
      if (next.has(tagId)) next.delete(tagId)
      else next.add(tagId)
      return next
    })
    setShowUntagged(false)
  }

  const tagsByGroup = useMemo(() => {
    const map = new Map<number, WecomTag[]>()
    for (const tag of tags) {
      const gid = tag.group || 0
      if (!map.has(gid)) map.set(gid, [])
      map.get(gid)!.push(tag)
    }
    return map
  }, [tags])

  const ungroupedTags = useMemo(() => tags.filter((t) => !t.group), [tags])

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('删除分组后，组内标签将变为未分组。确认删除？')) return
    try {
      await api.wecom.tagGroups.delete(groupId)
      if (selectedDeviceId !== null) loadTagsData(selectedDeviceId)
    } catch {
      // ignore
    }
  }

  const handleDeleteTag = async (tagId: number) => {
    if (!confirm('删除标签后，已打此标签的群聊将移除该标签。确认删除？')) return
    try {
      await api.wecom.tags.delete(tagId)
      if (selectedDeviceId !== null) loadTagsData(selectedDeviceId)
    } catch {
      // ignore
    }
  }

  const handleUpdateRoomTags = async (roomId: number, tagIds: number[]) => {
    try {
      await api.wecom.groupRoomTags.update(roomId, tagIds)
      setEditingRoomTags(null)
      loadRooms()
      if (selectedDeviceId !== null) loadTagsData(selectedDeviceId)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex h-full">
      {/* 左栏：设备选择 */}
      <DeviceSidebar
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        onSelect={setSelectedDeviceId}
        loading={devicesLoading}
      />

      {/* 中栏：标签分组树 */}
      <div className="flex w-64 flex-col border-r border-border-subtle">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium">分组管理</span>
          <div className="flex gap-1">
            <button
              onClick={() => { setEditingGroup(null); setShowCreateGroup(true) }}
              className="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-accent"
              title="新建分组"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setCreateTagGroupId(null); setShowCreateTag(true) }}
              className="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-accent"
              title="新建标签"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-2 pb-2">
          <button
            onClick={() => { setSelectedTagIds(new Set()); setShowUntagged(false) }}
            className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              !showUntagged && selectedTagIds.size === 0
                ? 'bg-accent/10 text-accent'
                : 'text-text-secondary hover:bg-bg-hover'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            全部群聊
          </button>
          <button
            onClick={() => { setSelectedTagIds(new Set()); setShowUntagged(true) }}
            className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              showUntagged
                ? 'bg-accent/10 text-accent'
                : 'text-text-secondary hover:bg-bg-hover'
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            未打标签
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {tagsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
            </div>
          ) : groups.length === 0 && ungroupedTags.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-text-muted">
              暂无标签<br />点击右上角创建
            </div>
          ) : (
            <>
              {groups.map((group) => (
                <div key={group.id} className="mb-1">
                  <div className="group flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-bg-hover">
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className="flex flex-1 items-center gap-1 text-sm text-text-primary"
                    >
                      {expandedGroups.has(group.id) ? (
                        <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
                      )}
                      <span className="truncate font-medium">{group.name}</span>
                      <span className="text-xs text-text-muted">({group.tag_count})</span>
                    </button>
                    <div className="hidden items-center gap-0.5 group-hover:flex">
                      <button
                        onClick={() => { setCreateTagGroupId(group.id); setShowCreateTag(true) }}
                        className="rounded p-0.5 text-text-muted hover:text-accent"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => { setEditingGroup(group); setShowCreateGroup(true) }}
                        className="rounded p-0.5 text-text-muted hover:text-accent"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="rounded p-0.5 text-text-muted hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  {expandedGroups.has(group.id) && (
                    <div className="ml-5 border-l border-border-subtle pl-1">
                      {(tagsByGroup.get(group.id) || []).map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => toggleTag(tag.id)}
                          className={`group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                            selectedTagIds.has(tag.id)
                              ? 'bg-accent/10 text-accent'
                              : 'text-text-secondary hover:bg-bg-hover'
                          }`}
                        >
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: tag.color || '#6b7280' }}
                          />
                          <span className="flex-1 truncate text-left">{tag.name}</span>
                          <span className="text-xs text-text-muted">{tag.group_room_count}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteTag(tag.id) }}
                            className="hidden rounded p-0.5 text-text-muted hover:text-red-500 group-hover:block"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </button>
                      ))}
                      {(tagsByGroup.get(group.id) || []).length === 0 && (
                        <div className="px-2 py-1 text-xs text-text-muted">暂无标签</div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {ungroupedTags.length > 0 && (
                <div className="mb-1">
                  <div className="flex items-center gap-1 rounded-lg px-2 py-1.5">
                    <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
                    <span className="text-sm font-medium text-text-primary">未分组</span>
                    <span className="text-xs text-text-muted">({ungroupedTags.length})</span>
                  </div>
                  <div className="ml-5 border-l border-border-subtle pl-1">
                    {ungroupedTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={`group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                          selectedTagIds.has(tag.id)
                            ? 'bg-accent/10 text-accent'
                            : 'text-text-secondary hover:bg-bg-hover'
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: tag.color || '#6b7280' }}
                        />
                        <span className="flex-1 truncate text-left">{tag.name}</span>
                        <span className="text-xs text-text-muted">{tag.group_room_count}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteTag(tag.id) }}
                          className="hidden rounded p-0.5 text-text-muted hover:text-red-500 group-hover:block"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 右栏：群聊列表 */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={roomSearch}
              onChange={(e) => setRoomSearch(e.target.value)}
              placeholder="搜索群聊名称"
              className="w-full rounded-lg border border-border-subtle bg-bg-input py-1.5 pl-8 pr-3 text-sm outline-none focus:border-accent"
            />
          </div>
          {selectedTagIds.size > 0 && (
            <div className="flex items-center gap-1 text-xs text-accent">
              <Tag className="h-3 w-3" />
              {selectedTagIds.size} 个标签筛选
              <button onClick={() => setSelectedTagIds(new Set())} className="ml-1 hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {roomsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-text-muted">
              <Users className="mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">暂无群聊</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="group flex items-center gap-3 px-4 py-2.5 hover:bg-bg-hover"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-medium text-accent">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{room.name}</span>
                      <span className="text-xs text-text-muted">{room.member_count}人</span>
                    </div>
                    {room.tags_display && room.tags_display.length > 0 ? (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {room.tags_display.map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded px-1.5 py-0.5 text-xs"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color,
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted">未打标签</span>
                    )}
                  </div>
                  <button
                    onClick={() => setEditingRoomTags(room.id)}
                    className="hidden rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent group-hover:block"
                    title="编辑标签"
                  >
                    <Tag className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border-subtle px-4 py-2 text-xs text-text-muted">
          共 {rooms.length} 个群聊
        </div>
      </div>

      {/* 弹窗 */}
      {showCreateGroup && (
        <CreateGroupModal
          device={selectedDeviceId}
          editingGroup={editingGroup}
          onClose={() => { setShowCreateGroup(false); setEditingGroup(null) }}
          onSuccess={() => {
            setShowCreateGroup(false)
            setEditingGroup(null)
            if (selectedDeviceId !== null) loadTagsData(selectedDeviceId)
          }}
        />
      )}

      {showCreateTag && (
        <CreateTagModal
          device={selectedDeviceId}
          groupId={createTagGroupId}
          groups={groups}
          onClose={() => { setShowCreateTag(false); setCreateTagGroupId(null) }}
          onSuccess={() => {
            setShowCreateTag(false)
            setCreateTagGroupId(null)
            if (selectedDeviceId !== null) loadTagsData(selectedDeviceId)
          }}
        />
      )}

      {editingRoomTags !== null && (
        <EditContactTagsModal
          contactId={editingRoomTags}
          allTags={tags}
          groups={groups}
          currentTagIds={rooms.find((r) => r.id === editingRoomTags)?.tags || []}
          onClose={() => setEditingRoomTags(null)}
          onSave={handleUpdateRoomTags}
        />
      )}
    </div>
  )
}

// ============================================================
// 弹窗：新建/编辑分组
// ============================================================

function CreateGroupModal({
  device,
  editingGroup,
  onClose,
  onSuccess,
}: {
  device: number | null
  editingGroup: WecomTagGroup | null
  onClose: () => void
  onSuccess: () => void
}) {
  const api = getApiClient()
  const [name, setName] = useState(editingGroup?.name || '')
  const [isCustomerLevel, setIsCustomerLevel] = useState(editingGroup?.is_customer_level || false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || device === null) return
    setSaving(true)
    try {
      if (editingGroup) {
        await api.wecom.tagGroups.update(editingGroup.id, { name: name.trim(), is_customer_level: isCustomerLevel })
      } else {
        await api.wecom.tagGroups.create({ device_id: device, name: name.trim(), is_customer_level: isCustomerLevel })
      }
      onSuccess()
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-96 rounded-xl bg-bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-medium">{editingGroup ? '编辑分组' : '新建分组'}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-text-secondary">分组名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：客户等级、个人标签"
              className="w-full rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-sm outline-none focus:border-accent"
              autoFocus
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isCustomerLevel}
              onChange={(e) => setIsCustomerLevel(e.target.checked)}
              className="rounded"
            />
            <span>客户等级分组（用于好友分层展示）</span>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 弹窗：新建标签
// ============================================================

function CreateTagModal({
  device,
  groupId,
  groups,
  onClose,
  onSuccess,
}: {
  device: number | null
  groupId: number | null
  groups: WecomTagGroup[]
  onClose: () => void
  onSuccess: () => void
}) {
  const api = getApiClient()
  const [name, setName] = useState('')
  const [color, setColor] = useState(TAG_COLORS[0].value)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(groupId)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || device === null) return
    setSaving(true)
    try {
      await api.wecom.tags.create({
        name: name.trim(),
        color,
        device_id: device,
        group_id: selectedGroupId || undefined,
      })
      onSuccess()
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-96 rounded-xl bg-bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-medium">新建标签</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-text-secondary">标签名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：VIP客户、待跟进"
              className="w-full rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-sm outline-none focus:border-accent"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-text-secondary">标签颜色</label>
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setColor(c.value)}
                  className={`flex h-7 w-7 items-center justify-center rounded-full transition-transform ${
                    color === c.value ? 'ring-2 ring-accent ring-offset-2' : ''
                  }`}
                  style={{ backgroundColor: c.value }}
                >
                  {color === c.value && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-text-secondary">所属分组</label>
            <select
              value={selectedGroupId || ''}
              onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">未分组</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 弹窗：编辑联系人/群聊标签
// ============================================================

function EditContactTagsModal({
  contactId,
  allTags,
  groups,
  currentTagIds,
  onClose,
  onSave,
}: {
  contactId: number
  allTags: WecomTag[]
  groups: WecomTagGroup[]
  currentTagIds: number[]
  onClose: () => void
  onSave: (id: number, tagIds: number[]) => void
}) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(currentTagIds))

  const toggle = (tagId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(tagId)) next.delete(tagId)
      else next.add(tagId)
      return next
    })
  }

  const tagsByGroup = useMemo(() => {
    const map = new Map<number, WecomTag[]>()
    for (const tag of allTags) {
      const gid = tag.group || 0
      if (!map.has(gid)) map.set(gid, [])
      map.get(gid)!.push(tag)
    }
    return map
  }, [allTags])

  const ungroupedTags = useMemo(() => allTags.filter((t) => !t.group), [allTags])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-96 rounded-xl bg-bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-medium">编辑标签</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 space-y-3 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.id}>
              <div className="mb-1 text-xs font-medium text-text-muted">{group.name}</div>
              <div className="flex flex-wrap gap-2">
                {(tagsByGroup.get(group.id) || []).map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggle(tag.id)}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm transition-colors ${
                      selectedIds.has(tag.id)
                        ? 'text-white'
                        : 'bg-bg-hover text-text-secondary hover:bg-bg-hover'
                    }`}
                    style={selectedIds.has(tag.id) ? { backgroundColor: tag.color } : {}}
                  >
                    {selectedIds.has(tag.id) && <Check className="h-3 w-3" />}
                    {tag.name}
                  </button>
                ))}
                {(tagsByGroup.get(group.id) || []).length === 0 && (
                  <span className="text-xs text-text-muted">暂无标签</span>
                )}
              </div>
            </div>
          ))}
          {ungroupedTags.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-text-muted">未分组</div>
              <div className="flex flex-wrap gap-2">
                {ungroupedTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggle(tag.id)}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm transition-colors ${
                      selectedIds.has(tag.id)
                        ? 'text-white'
                        : 'bg-bg-hover text-text-secondary hover:bg-bg-hover'
                    }`}
                    style={selectedIds.has(tag.id) ? { backgroundColor: tag.color } : {}}
                  >
                    {selectedIds.has(tag.id) && <Check className="h-3 w-3" />}
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {allTags.length === 0 && (
            <div className="py-8 text-center text-sm text-text-muted">暂无标签，请先创建标签</div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <span className="text-xs text-text-muted">已选 {selectedIds.size} 个标签</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
            >
              取消
            </button>
            <button
              onClick={() => onSave(contactId, Array.from(selectedIds))}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 弹窗：新建/编辑自动贴标签规则
// ============================================================

function CreateRuleModal({
  device,
  tags,
  editingRule,
  onClose,
  onSuccess,
}: {
  device: number | null
  tags: WecomTag[]
  editingRule: AutoTagRule | null
  onClose: () => void
  onSuccess: () => void
}) {
  const api = getApiClient()
  const [name, setName] = useState(editingRule?.name || '')
  const [keywords, setKeywords] = useState<string[]>(editingRule?.keywords || [])
  const [keywordInput, setKeywordInput] = useState('')
  const [matchMode, setMatchMode] = useState<'any' | 'all'>(editingRule?.match_mode || 'any')
  const [scope, setScope] = useState<'contact' | 'group'>(editingRule?.scope || 'contact')
  const [targetTag, setTargetTag] = useState<number>(editingRule?.target_tag || 0)
  const [saving, setSaving] = useState(false)

  const addKeyword = () => {
    const kw = keywordInput.trim()
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw])
      setKeywordInput('')
    }
  }

  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw))
  }

  const handleSave = async () => {
    if (!name.trim() || keywords.length === 0 || !targetTag || device === null) return
    setSaving(true)
    try {
      const data = {
        name: name.trim(),
        keywords,
        match_mode: matchMode,
        scope,
        target_tag: targetTag,
      }
      if (editingRule) {
        await api.marketing.autoTagRules.update(editingRule.id, data)
      } else {
        await api.marketing.autoTagRules.create({ device_id: device, ...data })
      }
      onSuccess()
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-[480px] rounded-xl bg-bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-medium">{editingRule ? '编辑规则' : '新增规则'}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 规则名称 */}
          <div>
            <label className="mb-1 block text-sm text-text-secondary">规则名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：高意向客户自动标记"
              className="w-full rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-sm outline-none focus:border-accent"
              autoFocus
            />
          </div>

          {/* 关键词 */}
          <div>
            <label className="mb-1 block text-sm text-text-secondary">
              关键词 <span className="text-text-muted">（好友消息/备注/群聊名称命中时触发）</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
                placeholder="输入关键词后回车"
                className="flex-1 rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <button
                onClick={addKeyword}
                className="rounded-lg bg-bg-hover px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover"
              >
                添加
              </button>
            </div>
            {keywords.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {keywords.map((kw) => (
                  <span
                    key={kw}
                    className="flex items-center gap-1 rounded bg-bg-hover px-2 py-0.5 text-xs text-text-secondary"
                  >
                    {kw}
                    <button onClick={() => removeKeyword(kw)} className="text-text-muted hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 匹配模式 */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-text-secondary">匹配模式</label>
              <select
                value={matchMode}
                onChange={(e) => setMatchMode(e.target.value as 'any' | 'all')}
                className="w-full rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-sm outline-none focus:border-accent"
              >
                <option value="any">任一命中（OR）</option>
                <option value="all">全部命中（AND）</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm text-text-secondary">作用范围</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as 'contact' | 'group')}
                className="w-full rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-sm outline-none focus:border-accent"
              >
                <option value="contact">好友</option>
                <option value="group">群聊</option>
              </select>
            </div>
          </div>

          {/* 目标标签 */}
          <div>
            <label className="mb-1 block text-sm text-text-secondary">命中后打标签</label>
            <select
              value={targetTag || ''}
              onChange={(e) => setTargetTag(Number(e.target.value))}
              className="w-full rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">请选择标签</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || keywords.length === 0 || !targetTag || saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

"""
apps/wecom/urls.py
企微管理路由
"""
from django.urls import path
from . import views

urlpatterns = [
    # Webhook（不需要认证）
    path('webhook/', views.wecom_webhook, name='wecom-webhook'),

    # 设备管理
    path('devices/', views.DeviceListCreateView.as_view(), name='wecom-device-list'),
    path('devices/<int:device_id>/', views.DeviceDetailView.as_view(), name='wecom-device-detail'),
    path('devices/<int:device_id>/logout/', views.DeviceLogoutView.as_view(), name='wecom-device-logout'),

    # 设备登录流程（多步骤绑定）
    path('area-codes/', views.AreaCodeListView.as_view(), name='wecom-area-codes'),
    path('devices/create-client/', views.DeviceCreateClientView.as_view(), name='wecom-device-create-client'),
    path('devices/get-qrcode/', views.DeviceGetQrcodeView.as_view(), name='wecom-device-get-qrcode'),
    path('devices/check-login/', views.DeviceCheckLoginView.as_view(), name='wecom-device-check-login'),
    path('devices/verify-code/', views.DeviceVerifyCodeView.as_view(), name='wecom-device-verify-code'),

    # 联系人管理
    path('contacts/', views.ContactListView.as_view(), name='wecom-contact-list'),
    path('contacts/<int:contact_id>/', views.ContactDetailView.as_view(), name='wecom-contact-detail'),

    # 消息管理
    path('messages/', views.MessageListView.as_view(), name='wecom-message-list'),
    path('messages/send/', views.MessageSendView.as_view(), name='wecom-message-send'),
    path('messages/<int:message_id>/', views.MessageDetailView.as_view(), name='wecom-message-detail'),
    path('messages/<int:message_id>/recall/', views.MessageDetailView.as_view(), name='wecom-message-recall'),

    # 消息收藏
    path('favorites/', views.FavoriteListCreateView.as_view(), name='wecom-favorite-list'),
    path('favorites/<int:favorite_id>/', views.FavoriteDetailView.as_view(), name='wecom-favorite-detail'),

    # 草稿管理
    path('drafts/', views.DraftView.as_view(), name='wecom-draft'),

    # SSE 实时推送
    path('sse/', views.SSEView.as_view(), name='wecom-sse'),

    # 已读回执
    path('messages/mark-read/', views.MarkAsReadView.as_view(), name='wecom-mark-read'),

    # 标签分组管理
    path('tag-groups/', views.TagGroupListCreateView.as_view(), name='wecom-tag-group-list'),
    path('tag-groups/<int:group_id>/', views.TagGroupDetailView.as_view(), name='wecom-tag-group-detail'),

    # 标签管理
    path('tags/', views.TagListCreateView.as_view(), name='wecom-tag-list'),
    path('tags/<int:tag_id>/', views.TagDetailView.as_view(), name='wecom-tag-detail'),

    # 联系人/群聊标签管理
    path('contacts/<int:contact_id>/tags/', views.ContactTagsUpdateView.as_view(), name='wecom-contact-tags'),
    path('groups/<int:group_id>/tags/', views.GroupRoomTagsUpdateView.as_view(), name='wecom-group-tags'),

    # 群聊管理
    path('groups/', views.GroupRoomListView.as_view(), name='wecom-group-list'),
    path('groups/<int:room_id>/members/', views.GroupRoomMembersView.as_view(), name='wecom-group-members'),

    # 同步操作
    path('sync/contacts/', views.SyncContactsView.as_view(), name='wecom-sync-contacts'),
    path('sync/groups/', views.SyncGroupsView.as_view(), name='wecom-sync-groups'),
    path('sync/tags/', views.SyncTagsView.as_view(), name='wecom-sync-tags'),

    # 企微设备绑定（新架构 — 租户用 GUID 绑定）
    path('devices/bind/', views.DeviceBindView.as_view(), name='wecom-device-bind'),
]


# Admin 企微管理路由（挂载到 /api/v1/admin/wecom/）
admin_wecom_urlpatterns = [
    path('config/', views.admin_wecom_config, name='admin-wecom-config'),
    path('area-codes/', views.admin_wecom_area_codes, name='admin-wecom-area-codes'),
    path('numbers/', views.admin_wecom_numbers, name='admin-wecom-numbers'),
    path('numbers/<int:number_id>/', views.admin_wecom_number_detail, name='admin-wecom-number-detail'),
]

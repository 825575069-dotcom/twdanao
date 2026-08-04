"""公共数据库路由"""
from django.urls import path
from . import views

urlpatterns = [
    # 供应商管理
    path('suppliers/', views.supplier_list),
    path('suppliers/create/', views.supplier_create),
    path('suppliers/<int:pk>/', views.supplier_detail),
    path('suppliers/<int:pk>/verify/', views.supplier_verify),
    path('suppliers/<int:pk>/sync/', views.supplier_sync_products),
    path('suppliers/<int:pk>/qualifications/', views.supplier_qualifications),
    path('qualifications/<int:pk>/delete/', views.qualification_delete),

    # 佣金协议
    path('commissions/', views.commission_protocol_list),

    # 产品
    path('products/', views.product_list),
    path('products/create/', views.product_create),
    path('products/<int:pk>/', views.product_detail),

    # 集采批次
    path('collective-batches/', views.collective_batch_list),
    path('collective-batches/<int:pk>/', views.collective_batch_detail),
    path('collective-batches/notify/', views.collective_batch_notify),
    path('collective-batches/<int:pk>/quote/', views.collective_batch_quote),
    path('collective-batches/distribute/', views.collective_batch_distribute),

    # 采购报价
    path('quotes/', views.quote_list),
    path('quotes/quick/', views.quote_quick),
    path('quotes/collective/', views.quote_collective),
    path('quotes/<int:pk>/accept/', views.quote_accept),
    path('quotes/<int:pk>/reject/', views.quote_reject),

    # 采购订单
    path('orders/', views.order_list),
    path('orders/create/', views.order_create),
    path('orders/quick-create/', views.order_quick_create),
    path('orders/<int:pk>/', views.order_detail),
    path('orders/<int:pk>/full-status/', views.order_full_status),
    path('orders/<int:pk>/sync-supplier/', views.order_sync_supplier),
    path('orders/<int:pk>/qualification/', views.order_qualification),
    path('orders/<int:pk>/e-sign/', views.order_e_sign),
    path('orders/<int:pk>/complete-sign/', views.order_complete_sign),

    # 支付
    path('payments/', views.payment_list),
    path('orders/<int:pk>/pay/', views.payment_create),
    path('payments/<int:pk>/process/', views.payment_process),
    path('payments/callback/', views.payment_callback),

    # 统计
    path('statistics/', views.statistics),

    # 集采公告
    path('announcements/', views.announcement_list),
    path('announcements/create/', views.announcement_create),
    path('announcements/<int:pk>/', views.announcement_detail),
    path('announcements/<int:pk>/publish/', views.announcement_publish),
    path('announcements/<int:pk>/aggregate/', views.announcement_aggregate),
    path('announcements/<int:pk>/push-suppliers/', views.announcement_push_suppliers),
    path('announcements/<int:pk>/distribute/', views.announcement_distribute),
    path('announcements/<int:pk>/close/', views.announcement_close),
    path('announcements/<int:pk>/cancel/', views.announcement_cancel),

    # 集采参与记录
    path('participations/', views.participation_list),
    path('participations/register/', views.participation_register),
    path('participations/batch-quote/', views.participation_batch_quote),
    path('participations/<int:pk>/quote/', views.participation_quote),
    path('participations/<int:pk>/adjust/', views.participation_adjust),
    path('participations/<int:pk>/decline/', views.participation_decline),
    path('participations/<int:pk>/create-order/', views.participation_create_order),

    # 供应商配送规则
    path('delivery-rules/', views.delivery_rule_list),
    path('delivery-rules/create/', views.delivery_rule_create),
    path('delivery-rules/<int:pk>/', views.delivery_rule_detail),
    path('suppliers/<int:supplier_id>/delivery-info/', views.supplier_delivery_info),

    # 供应商账号
    path('supplier-accounts/', views.supplier_account_list),
    path('supplier-accounts/create/', views.supplier_account_create),
    path('supplier-accounts/<int:pk>/', views.supplier_account_detail),

    # 供应商门户（Token 认证）
    path('supplier-portal/login/', views.supplier_portal_login),
    path('supplier-portal/dashboard/', views.supplier_portal_dashboard),
    path('supplier-portal/enhanced-dashboard/', views.supplier_portal_enhanced_dashboard),
    path('supplier-portal/orders/', views.supplier_portal_orders),
    path('supplier-portal/orders/<int:pk>/update/', views.supplier_portal_order_update),
    path('supplier-portal/products/', views.supplier_portal_products),
    path('supplier-portal/products/create/', views.supplier_portal_product_create),
    path('supplier-portal/products/<int:pk>/update/', views.supplier_portal_product_update),
    path('supplier-portal/products/<int:pk>/toggle-status/', views.supplier_portal_product_toggle_status),
    path('supplier-portal/products/<int:pk>/update-stock/', views.supplier_portal_product_update_stock),
    path('supplier-portal/products/<int:pk>/delete/', views.supplier_portal_product_delete),
    path('supplier-portal/qualifications/', views.supplier_portal_qualifications),
    path('supplier-portal/qualifications/create/', views.supplier_portal_qualification_create),
    path('supplier-portal/qualifications/upload/', views.supplier_portal_qualification_upload),
    path('supplier-portal/qualifications/<int:pk>/update/', views.supplier_portal_qualification_update),
    path('supplier-portal/qualifications/<int:pk>/delete/', views.supplier_portal_qualification_delete),
    path('supplier-portal/returns/', views.supplier_portal_returns),
    path('supplier-portal/returns/<int:pk>/approve/', views.supplier_portal_return_approve),
    path('supplier-portal/returns/<int:pk>/reject/', views.supplier_portal_return_reject),
    path('supplier-portal/returns/<int:pk>/complete/', views.supplier_portal_return_complete),
    path('supplier-portal/collective-items/', views.supplier_portal_collective_items),
    path('supplier-portal/aggregate-demand/', views.supplier_portal_aggregate_demand),
    path('supplier-portal/delivery-rules/', views.supplier_portal_delivery_rules),
    path('supplier-portal/delivery-rules/create/', views.supplier_portal_delivery_rule_create),
    path('supplier-portal/delivery-rules/<int:pk>/', views.supplier_portal_delivery_rule_detail),
    path('supplier-portal/quote/<int:pk>/', views.supplier_portal_submit_quote),
    path('supplier-portal/quote/<int:pk>/decline/', views.supplier_portal_decline_quote),
    path('supplier-portal/batch-quote/', views.supplier_portal_batch_quote),
    # 供应商门户 — 消息通知
    path('supplier-portal/notifications/', views.supplier_portal_notifications),
    path('supplier-portal/notifications/unread-count/', views.supplier_portal_unread_count),
    path('supplier-portal/notifications/<int:pk>/read/', views.supplier_portal_notification_read),
    path('supplier-portal/notifications/read-all/', views.supplier_portal_notification_read_all),
    # 供应商门户 — 订单导出
    path('supplier-portal/orders/export/', views.supplier_portal_orders_export),
    # 供应商门户 — 对账单
    path('supplier-portal/reconciliation/', views.supplier_portal_reconciliation),
    path('supplier-portal/reconciliation/export/', views.supplier_portal_reconciliation_export),
    # 供应商门户 — 钱包 & 提现
    path('supplier-portal/balance/', views.supplier_portal_balance),
    path('supplier-portal/withdrawals/', views.supplier_portal_withdrawals),
    path('supplier-portal/withdrawals/<int:pk>/cancel/', views.supplier_portal_withdrawal_cancel),
    # 供应商门户 — 银行卡管理
    path('supplier-portal/bank/send-code/', views.supplier_portal_bank_send_code),
    path('supplier-portal/bank/update/', views.supplier_portal_bank_update),
    # 平台后台 — 提现管理
    path('admin/withdrawals/', views.admin_withdrawal_list),
    path('admin/withdrawals/<int:pk>/approve/', views.admin_withdrawal_approve),
    path('admin/withdrawals/<int:pk>/reject/', views.admin_withdrawal_reject),
    path('admin/withdrawals/<int:pk>/complete/', views.admin_withdrawal_complete),
    path('admin/wallets/', views.admin_wallet_overview),

    # 租户资质管理
    path('tenant-qualifications/', views.tenant_qualifications),
    path('tenant-qualifications/<int:pk>/', views.tenant_qualification_detail),

    # 首营资料管理
    path('first-operations/', views.first_operations),
    path('first-operations/<int:pk>/', views.first_operation_detail),
    path('first-operations/<int:pk>/submit/', views.first_operation_submit),
    path('first-operations/<int:pk>/confirm/', views.first_operation_confirm),
    path('first-operations/<int:pk>/reject/', views.first_operation_reject),
    path('first-operations/<int:pk>/esign/', views.first_operation_esign),
    path('first-operations/<int:pk>/esign-status/', views.first_operation_esign_status),
    path('first-operations/<int:pk>/mock-sign/', views.first_operation_mock_sign),

    # 供应商门户 — 首营资料
    path('supplier-portal/first-operations/', views.supplier_portal_first_operations),
    path('supplier-portal/first-operations/create/', views.supplier_portal_first_operation_create),
    path('supplier-portal/first-operations/<int:pk>/', views.supplier_portal_first_operation_detail),
    path('supplier-portal/first-operations/<int:pk>/confirm/', views.supplier_portal_first_operation_confirm),
    path('supplier-portal/first-operations/<int:pk>/reject/', views.supplier_portal_first_operation_reject),
    # 供应商门户 — 租户列表
    path('supplier-portal/tenants/', views.supplier_portal_tenants),

    # 签章回调 Webhook
    path('esign/callback/', views.esign_callback),
]

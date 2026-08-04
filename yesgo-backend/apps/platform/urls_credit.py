"""积分管理路由 — 平台后台 + 租户端"""
from django.urls import path
from . import views_credit

urlpatterns = [
    # ===== 平台后台 =====
    # 积分配置
    path('config/', views_credit.credit_config_detail),
    path('config/update/', views_credit.credit_config_update),

    # 套餐管理
    path('packages/', views_credit.credit_package_list),
    path('packages/create/', views_credit.credit_package_create),
    path('packages/<int:package_id>/', views_credit.credit_package_update),
    path('packages/<int:package_id>/delete/', views_credit.credit_package_delete),

    # 智能体积分规则
    path('agent-rules/', views_credit.agent_credit_rule_list),
    path('agent-rules/<int:rule_id>/', views_credit.agent_credit_rule_update),

    # 订单管理
    path('orders/', views_credit.credit_order_list),
    path('orders/<int:order_id>/confirm/', views_credit.credit_order_confirm),
    path('orders/<int:order_id>/cancel/', views_credit.credit_order_cancel),

    # 手动充值
    path('recharge/', views_credit.credit_manual_recharge),

    # 收入统计
    path('stats/', views_credit.credit_stats),
]

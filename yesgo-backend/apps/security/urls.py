"""安全审计路由"""
from django.urls import path
from . import views

urlpatterns = [
    # 审计日志
    path('audit-logs', views.audit_log_list),
    path('audit-logs/stats', views.audit_log_stats),
    # 安全配置
    path('config', views.security_config_view),
    # 脱敏测试
    path('mask-test', views.mask_test),
    # 访问控制规则
    path('access-rules', views.access_rule_list),
    path('access-rules/<str:rule_id>', views.access_rule_detail),
    # 安全事件
    path('events', views.security_event_list),
    path('events/<str:event_id>/resolve', views.security_event_resolve),
    # 安全概览
    path('overview', views.security_overview),
]

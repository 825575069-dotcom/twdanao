"""模型网关路由"""
from django.urls import path
from . import views
from . import views_ext

urlpatterns = [
    # 基础模型管理
    path('list/', views.models_list),
    path('test/', views.models_test),
    path('config/', views.models_config),
    path('deploy/', views.models_deploy),

    # 密钥池管理
    path('keys/', views_ext.model_keys_view),
    path('keys/reset-quota/', views_ext.model_key_reset_quota),
    path('keys/<str:key_id>/', views_ext.model_key_detail),

    # Token用量统计
    path('token-usage/', views_ext.token_usage_stats),

    # 路由策略
    path('routing/', views_ext.routing_strategy_view),
    path('routing/<str:strategy_id>/', views_ext.routing_strategy_detail),

    # 熔断器
    path('circuit-breakers/', views_ext.circuit_breaker_list),
    path('circuit-breakers/reset/', views_ext.circuit_breaker_reset),

    # 限流器
    path('rate-limiter/', views_ext.rate_limiter_status),

    # 模型调用（网关入口）
    path('call/', views_ext.model_call),
]

"""
YesGo 天网大脑 — 主路由
对齐架构文档 v1.1 API 设计
"""
from django.http import JsonResponse
from django.urls import path, include


def root_index(request):
    """后端根路径：返回服务状态，并引导到健康检查接口"""
    return JsonResponse({
        'code': 0,
        'msg': 'ok',
        'data': {
            'service': 'yesgo-tianwang-brain',
            'status': 'running',
            'version': 'v1.0.0',
            'layer': '第二层：天网大脑后端',
            'health': '/api/v1/health/',
            'docs': '/api/v1/',
        }
    })


urlpatterns = [
    # ===== 根路径 =====
    path('', root_index, name='index'),

    # ===== 认证 =====
    path('api/v1/auth/', include('apps.platform.urls_auth')),
    # ===== 商户管理 =====
    path('api/v1/tenant/', include('apps.platform.urls_tenant')),
    # ===== 智能体对话 =====
    path('api/v1/chat/', include('apps.chat.urls')),
    # ===== 数据底座 =====
    path('api/v1/data/', include('apps.tenant_db.urls')),
    # ===== 经营看板 =====
    path('api/v1/dashboard/', include('apps.dashboard.urls')),
    # ===== 模型网关（含密钥池/Token统计/路由策略/熔断器） =====
    path('api/v1/models/', include('apps.model_gateway.urls')),
    # ===== 系统配置 =====
    path('api/v1/config/', include('apps.platform.urls_config')),
    # ===== 租户扩展（知识库/素材/任务/积分/技能/SaaS/连接器） =====
    path('api/v1/', include('apps.tenant_ext.urls')),
    # ===== 记忆引擎 =====
    path('api/v1/memory/', include('apps.memory_engine.urls')),
    # ===== 安全审计 =====
    path('api/v1/security/', include('apps.security.urls')),
    # ===== 商户数据接入（第一层预留） =====
    path('api/v1/platform/', include('apps.platform_gateway.urls')),
    # ===== 健康检查 =====
    path('api/v1/health/', include('apps.platform.urls_health')),
]

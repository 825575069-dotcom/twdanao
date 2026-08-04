"""
YesGo 天网大脑 — 主路由
对齐架构文档 v1.1 API 设计
"""
from django.http import JsonResponse
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from apps.platform import views_credit
from apps.wecom.urls import admin_wecom_urlpatterns


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
    # ===== 提示词（首页提示词 / 普通提示词） =====
    path('api/v1/prompts/', include('apps.platform.urls_prompt')),
    # ===== 平台智能体（公开读取 + 租户配置写回） =====
    path('api/v1/agents/', include('apps.platform.urls_agent')),
    # ===== 工作流模板（公开读取） =====
    path('api/v1/workflow-templates/', include('apps.platform.urls_workflow')),
    # ===== 平台数据库（SaaS 平台对接 + 企业同步匹配） =====
    path('api/v1/platform-databases/', include('apps.platform.urls_database')),
    # ===== 公共数据库（供应商产品 + 采购报价 + 集采 + 订单 + 支付分账） =====
    path('api/v1/public-databases/', include('apps.public_database.urls')),
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
    # ===== 平台管理后台（第二层权限管理：总部员工/平台角色） =====
    path('api/v1/admin/', include('apps.platform.urls_admin')),
    # ===== 平台管理后台 — 企微管理 =====
    path('api/v1/admin/wecom/', include(admin_wecom_urlpatterns)),
    # ===== 积分管理（平台后台配置 + 租户端购买） =====
    path('api/v1/admin/credits/', include('apps.platform.urls_credit')),
    path('api/v1/credits/packages/', views_credit.credit_packages_public),
    path('api/v1/credits/orders/', views_credit.credit_order_my_list),
    path('api/v1/credits/orders/create/', views_credit.credit_order_create),
    # ===== 健康检查 =====
    path('api/v1/health/', include('apps.platform.urls_health')),
    # ===== 企微管理（设备/联系人/消息/标签/群聊 + Webhook） =====
    path('api/v1/wecom/', include('apps.wecom.urls')),
    # ===== 营销跟客（聊天设置/AI回复任务/主动跟进/群发/朋友圈/客户画像/看板） =====
    path('api/v1/marketing/', include('apps.marketing_follow.urls')),
]

# 媒体文件服务（开发和生产环境都需要）
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

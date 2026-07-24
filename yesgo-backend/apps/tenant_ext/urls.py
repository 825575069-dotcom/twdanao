"""租户扩展路由"""
from django.urls import path
from . import views

urlpatterns = [
    # ===== 知识库 =====
    path('docs', views.knowledge_docs),
    path('docs/<str:doc_id>', views.knowledge_doc_delete),

    # ===== 素材 =====
    path('assets', views.media_assets),
    path('assets/<str:asset_id>', views.media_asset_delete),

    # ===== 任务 =====
    path('tasks', views.tasks),
    path('tasks/<str:task_id>', views.task_update),
    path('tasks/<str:task_id>/delete', views.task_delete),

    # ===== 积分 =====
    path('credits/balance', views.credits_balance),
    path('credits/ledger', views.credits_ledger),
    path('credits/recharge', views.credits_recharge),

    # ===== 技能 =====
    path('skills/list', views.skills_list),
    path('skills/toggle', views.skills_toggle),

    # ===== SaaS 连接 =====
    path('saas/connections', views.saas_connections),
    path('saas/connections/<str:conn_id>', views.saas_connection_update),

    # ===== 数据底座连接器 =====
    path('connectors', views.connectors),
    path('connectors/<str:conn_id>', views.connector_update),
    path('connectors/<str:conn_id>/delete', views.connector_delete),
]

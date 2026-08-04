"""平台智能体 + 工作流模板路由"""
from django.urls import path
from . import views_agent, views_role

urlpatterns = [
    # ===== 平台智能体 =====
    path('', views_agent.agent_list, name='agent-list'),
    path('create/', views_agent.agent_create, name='agent-create'),
    path('public-databases/', views_agent.public_database_list, name='public-database-list'),
    path('<int:pk>/', views_agent.agent_detail, name='agent-detail'),
    # ===== 智能体角色 =====
    path('roles/', views_role.agent_role_list, name='agent-role-list'),
    path('roles/create/', views_role.agent_role_create, name='agent-role-create'),
    path('roles/<int:pk>/', views_role.agent_role_detail, name='agent-role-detail'),
    # ===== 租户智能体配置 =====
    path('configs/', views_agent.agent_config_list, name='agent-config-list'),
    path('configs/<str:agent_id>/', views_agent.agent_config_detail, name='agent-config-detail'),
]

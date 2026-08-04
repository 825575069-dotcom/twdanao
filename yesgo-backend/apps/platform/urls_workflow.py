"""工作流模板路由"""
from django.urls import path
from . import views_agent

urlpatterns = [
    path('', views_agent.workflow_template_list, name='workflow-template-list'),
    path('create/', views_agent.workflow_template_create, name='workflow-template-create'),
    path('<int:pk>/', views_agent.workflow_template_detail, name='workflow-template-detail'),
]

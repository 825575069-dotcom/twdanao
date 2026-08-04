"""
apps/marketing_follow/urls.py
营销跟客 API 路由
"""
from django.urls import path
from . import views

urlpatterns = [
    # 聊天设置
    path('chat-settings/', views.ChatSettingListView.as_view()),
    path('chat-settings/<int:device_id>/', views.ChatSettingDetailView.as_view()),

    # AI 回复任务
    path('ai-reply-tasks/', views.AiReplyTaskListView.as_view()),

    # 主动跟进任务
    path('proactive-tasks/', views.ProactiveFollowTaskListView.as_view()),

    # 群发任务
    path('broadcast-tasks/', views.BroadcastTaskListView.as_view()),
    path('broadcast-tasks/create/', views.BroadcastTaskCreateView.as_view()),
    path('broadcast-tasks/<int:task_id>/', views.BroadcastTaskDetailView.as_view()),
    path('broadcast-tasks/<int:task_id>/toggle/', views.BroadcastTaskToggleView.as_view()),
    path('broadcast-tasks/<int:task_id>/recipients/', views.BroadcastTaskRecipientsView.as_view()),

    # 朋友圈任务
    path('moments-tasks/', views.MomentsTaskListView.as_view()),
    path('moments-tasks/<int:task_id>/', views.MomentsTaskDetailView.as_view()),
    path('moments-tasks/batch-delete/', views.MomentsTaskBatchDeleteView.as_view()),
    path('moments-tasks/<int:task_id>/toggle/', views.MomentsTaskToggleView.as_view()),

    # 客户画像
    path('customer-profiles/', views.CustomerProfileListView.as_view()),

    # 数据看板
    path('dashboard/', views.DashboardView.as_view()),

    # 营销自动化任务
    path('marketing-tasks/', views.MarketingTaskListView.as_view()),
    path('marketing-tasks/<int:task_id>/', views.MarketingTaskDetailView.as_view()),
    path('marketing-tasks/<int:task_id>/toggle/', views.MarketingTaskToggleView.as_view()),
    path('marketing-tasks/<int:task_id>/executions/', views.MarketingTaskExecutionsView.as_view()),

    # 自动贴标签规则
    path('auto-tag-rules/', views.AutoTagRuleListCreateView.as_view()),
    path('auto-tag-rules/<int:rule_id>/', views.AutoTagRuleDetailView.as_view()),
    path('auto-tag-rules/<int:rule_id>/run/', views.AutoTagRuleRunView.as_view()),

    # 精准群发任务
    path('mass-send-tasks/', views.MassSendTaskListView.as_view()),
    path('mass-send-tasks/<int:task_id>/', views.MassSendTaskDetailView.as_view()),
    path('mass-send-tasks/batch-delete/', views.MassSendTaskBatchDeleteView.as_view()),
    path('mass-send-tasks/<int:task_id>/toggle/', views.MassSendTaskToggleView.as_view()),
]

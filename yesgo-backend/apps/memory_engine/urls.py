"""记忆引擎路由"""
from django.urls import path
from . import views

urlpatterns = [
    # 记忆配置
    path('config', views.memory_config_view),
    # 摘要管理
    path('summaries', views.memory_summary_list),
    path('summaries/generate', views.memory_summary_generate),
    path('summaries/<str:summary_id>', views.memory_summary_delete),
    # 关键事实
    path('facts', views.memory_fact_list),
    path('facts/create', views.memory_fact_create),
    path('facts/<str:fact_id>', views.memory_fact_delete),
    # 召回日志
    path('recall-logs', views.memory_recall_logs),
    # 记忆召回
    path('recall', views.memory_recall),
    # 统计
    path('stats', views.memory_stats),
    # 清理
    path('cleanup', views.memory_cleanup),
]

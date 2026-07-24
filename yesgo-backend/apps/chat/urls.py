"""对话路由"""
from django.urls import path
from . import views

urlpatterns = [
    path('send', views.chat_send),
    path('history', views.chat_history),
    path('conversations', views.chat_conversations),
]

"""提示词路由"""
from django.urls import path
from . import views_prompt

urlpatterns = [
    path('', views_prompt.prompt_list, name='prompt-list'),
    path('create/', views_prompt.prompt_create, name='prompt-create'),
    path('<int:pk>/', views_prompt.prompt_detail, name='prompt-detail'),
]

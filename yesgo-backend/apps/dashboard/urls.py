"""经营看板路由"""
from django.urls import path
from . import views

urlpatterns = [
    path('overview/', views.overview),
    path('kpi/', views.kpi),
    path('alerts/', views.alerts),
]

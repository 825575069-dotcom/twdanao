"""认证路由"""
from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.login),
    path('logout/', views.logout),
    path('me/', views.me),
    path('refresh/', views.token_refresh),
    path('forgot-password/send-code/', views.forgot_password_send_code),
    path('forgot-password/verify-code/', views.forgot_password_verify_code),
    path('forgot-password/reset/', views.forgot_password_reset),
]

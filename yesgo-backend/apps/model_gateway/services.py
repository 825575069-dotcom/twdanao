"""
熔断器 + 限流器 —— 模型网关高可用组件
"""

import time
from datetime import timedelta
from django.utils import timezone
from django.core.cache import cache

from .models_ext import CircuitBreakerState, AIModel


class CircuitBreaker:
    """
    熔断器 —— 连续失败 N 次后熔断，等待恢复超时后进入半开状态
    状态机：closed（正常）→ open（熔断）→ half_open（试探）→ closed/old_open
    """

    def __init__(self, model: AIModel):
        self.model = model
        self.state_obj, _ = CircuitBreakerState.objects.get_or_create(
            model=model,
            defaults={
                'failure_threshold': 5,
                'recovery_timeout': 60,
            }
        )

    @property
    def state(self) -> str:
        """获取当前熔断器状态（考虑自动恢复）"""
        if self.state_obj.state == 'open':
            # 检查是否到了恢复时间
            if self.state_obj.last_failure:
                elapsed = (timezone.now() - self.state_obj.last_failure).total_seconds()
                if elapsed >= self.state_obj.recovery_timeout:
                    # 自动进入半开状态
                    self.state_obj.state = 'half_open'
                    self.state_obj.last_state_change = timezone.now()
                    self.state_obj.save()
                    return 'half_open'
        return self.state_obj.state

    def can_request(self) -> bool:
        """是否允许请求"""
        current_state = self.state
        return current_state in ('closed', 'half_open')

    def record_success(self):
        """记录成功"""
        if self.state_obj.state in ('open', 'half_open'):
            self.state_obj.state = 'closed'
            self.state_obj.last_state_change = timezone.now()
        self.state_obj.failure_count = 0
        self.state_obj.save()

    def record_failure(self, error: str = ''):
        """记录失败"""
        self.state_obj.failure_count += 1
        self.state_obj.last_failure = timezone.now()
        self.state_obj.last_error = error[:500]

        if self.state_obj.state == 'half_open':
            # 半开状态失败 → 重新熔断
            self.state_obj.state = 'open'
            self.state_obj.last_state_change = timezone.now()
        elif self.state_obj.failure_count >= self.state_obj.failure_threshold:
            # 达到阈值 → 熔断
            self.state_obj.state = 'open'
            self.state_obj.last_state_change = timezone.now()

        self.state_obj.save()

    def reset(self):
        """手动重置熔断器"""
        self.state_obj.state = 'closed'
        self.state_obj.failure_count = 0
        self.state_obj.last_failure = None
        self.state_obj.last_state_change = timezone.now()
        self.state_obj.save()

    def get_status(self) -> dict:
        """获取熔断器状态"""
        return {
            'model_id': str(self.model.id),
            'model_name': self.model.name,
            'state': self.state,
            'failure_count': self.state_obj.failure_count,
            'failure_threshold': self.state_obj.failure_threshold,
            'recovery_timeout': self.state_obj.recovery_timeout,
            'last_failure': self.state_obj.last_failure.isoformat() if self.state_obj.last_failure else None,
            'last_error': self.state_obj.last_error,
        }


class RateLimiter:
    """
    限流器 —— 基于 Django cache 的滑动窗口限流
    按 tenant + user 维度限流
    """

    def __init__(self, key: str, max_requests: int = 60, window_seconds: int = 60):
        self.key = key
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    def can_request(self) -> bool:
        """是否允许请求"""
        cache_key = f'rate_limit:{self.key}'
        now = time.time()
        window_start = now - self.window_seconds

        # 获取当前窗口内的请求记录
        requests = cache.get(cache_key, [])
        # 过滤出窗口内的请求
        requests = [t for t in requests if t > window_start]

        if len(requests) >= self.max_requests:
            return False

        # 记录本次请求
        requests.append(now)
        cache.set(cache_key, requests, self.window_seconds)
        return True

    def get_remaining(self) -> int:
        """获取剩余可用请求数"""
        cache_key = f'rate_limit:{self.key}'
        now = time.time()
        window_start = now - self.window_seconds
        requests = cache.get(cache_key, [])
        requests = [t for t in requests if t > window_start]
        return max(0, self.max_requests - len(requests))

    def get_status(self) -> dict:
        """获取限流状态"""
        return {
            'key': self.key,
            'max_requests': self.max_requests,
            'window_seconds': self.window_seconds,
            'remaining': self.get_remaining(),
        }


class KeyPool:
    """
    密钥池管理 —— 多密钥轮转 + 自动禁用 + 额度追踪
    """

    def __init__(self, model: AIModel):
        self.model = model

    def get_available_key(self):
        """获取可用的 API Key（按优先级+状态+额度筛选）"""
        from .models_ext import ModelKey
        keys = ModelKey.objects.filter(
            model=self.model,
            status='active',
        ).order_by('priority', '-created_at')

        for key in keys:
            # 检查每日配额
            if key.daily_quota > 0 and key.daily_used >= key.daily_quota:
                continue
            return key
        return None

    def record_usage(self, key_id, tokens: int = 0):
        """记录密钥使用"""
        from .models_ext import ModelKey
        try:
            key = ModelKey.objects.get(id=key_id)
            key.daily_used += 1
            key.total_used += 1
            key.last_used = timezone.now()
            key.error_count = 0  # 重置错误计数
            key.save()
        except ModelKey.DoesNotExist:
            pass

    def record_error(self, key_id, error: str = ''):
        """记录密钥错误"""
        from .models_ext import ModelKey
        try:
            key = ModelKey.objects.get(id=key_id)
            key.error_count += 1
            key.last_error = error[:500]
            # 连续3次错误自动禁用
            if key.error_count >= 3:
                key.status = 'error'
            key.save()
        except ModelKey.DoesNotExist:
            pass

    def reset_daily_quota(self):
        """重置每日配额"""
        from .models_ext import ModelKey
        ModelKey.objects.filter(model=self.model).update(daily_used=0)

    def get_pool_status(self) -> list:
        """获取密钥池状态"""
        from .models_ext import ModelKey
        keys = ModelKey.objects.filter(model=self.model).order_by('priority')
        return [{
            'id': str(k.id),
            'alias': k.key_alias,
            'status': k.status,
            'priority': k.priority,
            'daily_quota': k.daily_quota,
            'daily_used': k.daily_used,
            'total_used': k.total_used,
            'error_count': k.error_count,
            'last_used': k.last_used.isoformat() if k.last_used else None,
            'last_error': k.last_error,
        } for k in keys]

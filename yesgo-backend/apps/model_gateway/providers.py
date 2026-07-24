"""
LLM Provider 抽象层 —— 统一接口对接不同大模型厂商
当前为 Mock 实现，后续接入真实 SDK 只需替换 call 方法
"""

import time
import random
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class LLMResponse:
    """LLM 统一响应"""
    content: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    latency_ms: int
    model_name: str
    cost: float = 0.0
    success: bool = True
    error: str = ''

    def to_dict(self) -> dict:
        return {
            'content': self.content,
            'prompt_tokens': self.prompt_tokens,
            'completion_tokens': self.completion_tokens,
            'total_tokens': self.total_tokens,
            'latency_ms': self.latency_ms,
            'model_name': self.model_name,
            'cost': self.cost,
            'success': self.success,
            'error': self.error,
        }


class BaseLLMProvider(ABC):
    """LLM Provider 抽象基类"""

    def __init__(self, model_name: str, api_key: str = '', endpoint: str = '', **kwargs):
        self.model_name = model_name
        self.api_key = api_key
        self.endpoint = endpoint
        self.temperature = kwargs.get('temperature', 0.7)
        self.max_tokens = kwargs.get('max_tokens', 4096)

    @abstractmethod
    def call(self, messages: list, **kwargs) -> LLMResponse:
        """调用 LLM"""
        pass

    @abstractmethod
    def test_connection(self) -> dict:
        """测试连接"""
        pass


class OpenAIProvider(BaseLLMProvider):
    """OpenAI 兼容 Provider（GPT/Qwen/DeepSeek 等兼容接口）"""

    def call(self, messages: list, **kwargs) -> LLMResponse:
        start = time.time()
        # Mock 实现 —— 后续替换为真实 API 调用
        # import openai
        # client = openai.OpenAI(api_key=self.api_key, base_url=self.endpoint)
        # response = client.chat.completions.create(
        #     model=self.model_name,
        #     messages=messages,
        #     temperature=self.temperature,
        #     max_tokens=self.max_tokens,
        # )

        time.sleep(random.uniform(0.3, 0.8))
        latency = int((time.time() - start) * 1000)

        # 生成 Mock 回复
        last_msg = messages[-1]['content'] if messages else ''
        content = f'[{self.model_name}] 已分析您的请求："{last_msg[:50]}"。基于当前数据，这是我的建议方案。'

        prompt_tokens = sum(len(m['content']) * 1.5 for m in messages)
        completion_tokens = len(content) * 1.5
        total = int(prompt_tokens + completion_tokens)

        return LLMResponse(
            content=content,
            prompt_tokens=int(prompt_tokens),
            completion_tokens=int(completion_tokens),
            total_tokens=total,
            latency_ms=latency,
            model_name=self.model_name,
            success=True,
        )

    def test_connection(self) -> dict:
        start = time.time()
        # Mock 测试
        time.sleep(random.uniform(0.1, 0.3))
        latency = int((time.time() - start) * 1000)
        return {
            'connected': True,
            'latency_ms': latency,
            'model': self.model_name,
            'msg': f'{self.model_name} 连接成功',
        }


class AnthropicProvider(BaseLLMProvider):
    """Anthropic Claude Provider"""

    def call(self, messages: list, **kwargs) -> LLMResponse:
        start = time.time()
        # Mock 实现
        # import anthropic
        # client = anthropic.Anthropic(api_key=self.api_key)
        # response = client.messages.create(
        #     model=self.model_name,
        #     messages=messages,
        #     max_tokens=self.max_tokens,
        # )

        time.sleep(random.uniform(0.4, 1.0))
        latency = int((time.time() - start) * 1000)

        last_msg = messages[-1]['content'] if messages else ''
        content = f'[{self.model_name}] Claude 分析："{last_msg[:50]}"。建议如下处理方案。'

        prompt_tokens = sum(len(m['content']) * 1.5 for m in messages)
        completion_tokens = len(content) * 1.5
        total = int(prompt_tokens + completion_tokens)

        return LLMResponse(
            content=content,
            prompt_tokens=int(prompt_tokens),
            completion_tokens=int(completion_tokens),
            total_tokens=total,
            latency_ms=latency,
            model_name=self.model_name,
            success=True,
        )

    def test_connection(self) -> dict:
        start = time.time()
        time.sleep(random.uniform(0.2, 0.5))
        latency = int((time.time() - start) * 1000)
        return {
            'connected': True,
            'latency_ms': latency,
            'model': self.model_name,
            'msg': f'{self.model_name} 连接成功',
        }


class LocalModelProvider(BaseLLMProvider):
    """本地开源模型 Provider（vLLM/Ollama 等）"""

    def call(self, messages: list, **kwargs) -> LLMResponse:
        start = time.time()
        # Mock 实现
        # import requests
        # response = requests.post(
        #     f'{self.endpoint}/v1/chat/completions',
        #     json={'model': self.model_name, 'messages': messages, ...}
        # )

        time.sleep(random.uniform(0.2, 0.6))
        latency = int((time.time() - start) * 1000)

        last_msg = messages[-1]['content'] if messages else ''
        content = f'[{self.model_name}] 本地模型已处理："{last_msg[:50]}"。'

        prompt_tokens = sum(len(m['content']) * 1.5 for m in messages)
        completion_tokens = len(content) * 1.5
        total = int(prompt_tokens + completion_tokens)

        return LLMResponse(
            content=content,
            prompt_tokens=int(prompt_tokens),
            completion_tokens=int(completion_tokens),
            total_tokens=total,
            latency_ms=latency,
            model_name=self.model_name,
            success=True,
        )

    def test_connection(self) -> dict:
        start = time.time()
        time.sleep(random.uniform(0.05, 0.2))
        latency = int((time.time() - start) * 1000)
        return {
            'connected': True,
            'latency_ms': latency,
            'model': self.model_name,
            'msg': f'{self.model_name} 本地模型连接成功',
        }


# Provider 注册表
PROVIDER_REGISTRY = {
    'openai': OpenAIProvider,
    'anthropic': AnthropicProvider,
    'local': LocalModelProvider,
}


def get_provider(model) -> Optional[BaseLLMProvider]:
    """
    根据模型配置获取对应的 Provider 实例
    model: AIModel 对象
    """
    vendor_lower = (model.vendor or '').lower()

    # 按厂商名称匹配 Provider
    if any(k in vendor_lower for k in ['openai', 'gpt', 'qwen', '通义', 'deepseek', 'moonshot', 'zhipu', '智谱']):
        provider_cls = OpenAIProvider
    elif any(k in vendor_lower for k in ['anthropic', 'claude']):
        provider_cls = AnthropicProvider
    elif any(k in vendor_lower for k in ['local', '本地', 'vllm', 'ollama', 'llama', 'chatglm']):
        provider_cls = LocalModelProvider
    else:
        provider_cls = OpenAIProvider  # 默认使用 OpenAI 兼容接口

    return provider_cls(
        model_name=model.name,
        api_key=model.api_key,
        endpoint=model.endpoint,
        **(model.config or {}),
    )

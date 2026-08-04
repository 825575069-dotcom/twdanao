"""Dify 工作流真实调用客户端。

使用 Python 标准库 urllib 发起 HTTP 请求，不引入额外依赖。
对接 Dify Workflow API: POST /v1/workflows/run
文档：https://docs.dify.ai/guides/workflow/introduce
"""

import json
import logging
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class DifyWorkflowResult:
    success: bool
    reply: str = ''
    outputs: Dict[str, Any] = None  # type: ignore[assignment]
    workflow_run_id: str = ''
    task_id: str = ''
    total_tokens: int = 0
    elapsed_time: float = 0.0
    status: str = ''
    error: str = ''

    def __post_init__(self):
        if self.outputs is None:
            self.outputs = {}


def _normalize_base_url(base_url: str) -> str:
    """去掉末尾 /v1 等版本号，确保拼接出 /v1/workflows/run。"""
    url = (base_url or '').strip()
    if not url:
        url = 'https://api.dify.ai/v1'
    # 去掉末尾斜杠
    url = url.rstrip('/')
    # 如果以 /v1 结尾，保留；否则追加 /v1
    if not url.endswith('/v1'):
        url = url + '/v1'
    return url


def invoke_dify_workflow(
    api_key: str,
    base_url: str,
    user: str,
    inputs: Optional[Dict[str, Any]] = None,
    response_mode: str = 'blocking',
    timeout: int = 60,
) -> DifyWorkflowResult:
    """真实调用 Dify Workflow API。

    Args:
        api_key: Dify 工作流 API Key。
        base_url: Dify 服务地址，如 https://api.dify.ai/v1。
        user: 用户标识，Dify 用于隔离会话。
        inputs: 工作流输入参数。
        response_mode: 'blocking' | 'streaming'，默认阻塞模式。
        timeout: 请求超时秒数。

    Returns:
        DifyWorkflowResult
    """
    if not api_key:
        return DifyWorkflowResult(success=False, error='Dify API Key 未配置')

    url = _normalize_base_url(base_url) + '/workflows/run'
    payload: Dict[str, Any] = {
        'inputs': inputs or {},
        'response_mode': response_mode,
        'user': user or 'anonymous',
    }

    data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json',
    }

    start = time.time()
    try:
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode('utf-8')
            try:
                json_data = json.loads(body)
            except json.JSONDecodeError as e:
                return DifyWorkflowResult(
                    success=False,
                    error=f'Dify 返回非 JSON: {str(e)}',
                )

            elapsed = round(time.time() - start, 3)
            return _parse_dify_response(json_data, elapsed)

    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8') if hasattr(e, 'read') else ''
        error_msg = f'Dify 请求失败 ({e.code})'
        try:
            err_json = json.loads(body)
            if isinstance(err_json, dict):
                error_msg = err_json.get('message') or err_json.get('msg') or error_msg
        except Exception:
            if body:
                error_msg = f'{error_msg}: {body[:200]}'
        logger.warning('Dify HTTPError: %s', error_msg)
        return DifyWorkflowResult(success=False, error=error_msg)

    except urllib.error.URLError as e:
        logger.warning('Dify URLError: %s', e.reason)
        return DifyWorkflowResult(success=False, error=f'无法连接到 Dify: {e.reason}')

    except TimeoutError:
        logger.warning('Dify timeout after %ss', timeout)
        return DifyWorkflowResult(success=False, error=f'Dify 请求超时（{timeout}秒）')

    except Exception as e:
        logger.exception('Dify invoke error')
        return DifyWorkflowResult(success=False, error=f'Dify 调用异常: {str(e)}')


def _parse_dify_response(data: Dict[str, Any], elapsed: float) -> DifyWorkflowResult:
    """解析 Dify /workflows/run 响应。"""
    # 阻塞模式返回结构
    # {
    #   "workflow_run_id": "...",
    #   "task_id": "...",
    #   "data": {
    #     "id": "...",
    #     "workflow_id": "...",
    #     "status": "succeeded",
    #     "outputs": { "reply": "...", ... },
    #     "error": null,
    #     "elapsed_time": 1.23,
    #     "total_tokens": 123,
    #     ...
    #   }
    # }
    task_id = data.get('task_id', '')
    workflow_run_id = data.get('workflow_run_id', '')

    inner = data.get('data', {}) if isinstance(data.get('data'), dict) else data
    status = inner.get('status', '')
    outputs = inner.get('outputs', {}) or {}
    total_tokens = inner.get('total_tokens', 0) or 0
    error = inner.get('error', '') or ''

    # 兼容 Dify 直接把 outputs 放在根层的情况
    if not outputs and isinstance(data.get('outputs'), dict):
        outputs = data['outputs']

    reply = ''
    if isinstance(outputs, dict):
        # 优先取常见输出字段
        for key in ('reply', 'answer', 'content', 'text', 'result'):
            if outputs.get(key):
                reply = str(outputs[key])
                break
        if not reply:
            # 兜底：把 outputs 序列化为文本
            try:
                reply = json.dumps(outputs, ensure_ascii=False)
            except Exception:
                reply = str(outputs)

    success = status in ('succeeded', 'success') and not error

    return DifyWorkflowResult(
        success=success,
        reply=reply,
        outputs=outputs if isinstance(outputs, dict) else {},
        workflow_run_id=str(workflow_run_id),
        task_id=str(task_id),
        total_tokens=int(total_tokens) if total_tokens else 0,
        elapsed_time=elapsed,
        status=str(status),
        error=str(error) if error else '',
    )


def build_dify_inputs(
    tenant,
    agent,
    message_text: str,
    memory_context: Optional[str] = None,
    knowledge_context: Optional[str] = None,
    data_context: Optional[str] = None,
    media_context: Optional[str] = None,
    role_context: Optional[str] = None,
) -> Dict[str, Any]:
    """构造 Dify 工作流输入参数。

    将天网大脑的配置数据（知识文档、数据底座、营销素材、角色定位）
    作为 inputs 注入给外部平台 AI，让 Dify 工作流可以直接使用。

    Dify 工作流中可通过变量引用这些字段：
    - {{inputs.query}} / {{inputs.message}}: 用户消息
    - {{inputs.role_description}}: 智能体角色定位
    - {{inputs.knowledge_context}}: 知识文档 RAG 检索结果（文本）
    - {{inputs.data_context}}: 数据底座查询结果（文本）
    - {{inputs.media_context}}: 营销素材信息（文本）
    - {{inputs.memory_context}}: 记忆上下文
    """
    inputs: Dict[str, Any] = {
        'tenant_code': tenant.code if tenant else '',
        'tenant_name': tenant.name if tenant else '',
        'tenant_config': {},
        'role_code': agent.code if agent else '',
        'role_name': agent.name if agent else '',
        'role_description': '',
        'query': message_text,
        'message': message_text,
        'knowledge_context': '',
        'data_context': '',
        'media_context': '',
        'memory_context': '',
    }

    # 角色定位
    if role_context:
        inputs['role_description'] = role_context

    # 知识文档 RAG
    if knowledge_context:
        inputs['knowledge_context'] = knowledge_context

    # 数据底座
    if data_context:
        inputs['data_context'] = data_context

    # 营销素材
    if media_context:
        inputs['media_context'] = media_context

    # 记忆上下文
    if memory_context:
        inputs['memory_context'] = memory_context

    return inputs

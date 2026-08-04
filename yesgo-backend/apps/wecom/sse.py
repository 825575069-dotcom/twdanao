"""
apps/wecom/sse.py
In-memory pub/sub for SSE (Server-Sent Events)

Since the project runs on WSGI (Gunicorn) without Redis/Channels,
this module provides a lightweight in-memory pub/sub using queue.Queue
per subscriber, protected by threading.Lock.

Each subscriber is keyed by (tenant_id, device_id).
Events are JSON-serializable dicts: {"type": "message"|"typing"|"read_receipt", "data": {...}}
"""
import json
import logging
import queue
import threading
import time
from django.utils import timezone

logger = logging.getLogger(__name__)

# Maximum queue size per subscriber (prevent memory leak if client is slow)
_MAX_QUEUE_SIZE = 200

# Lock protecting the _subscribers dict
_lock = threading.Lock()

# { (tenant_id, device_id): set of queue.Queue }
_subscribers: dict[tuple, set] = {}


def subscribe(tenant_id, device_id):
    """
    Subscribe to events for a given (tenant_id, device_id).
    Returns a queue.Queue that will receive event dicts.
    The caller must call unsubscribe() when done.
    """
    key = (tenant_id, device_id)
    q = queue.Queue(maxsize=_MAX_QUEUE_SIZE)
    with _lock:
        if key not in _subscribers:
            _subscribers[key] = set()
        _subscribers[key].add(q)
    logger.debug(f'SSE subscribe: tenant={tenant_id} device={device_id} (total={len(_subscribers.get(key, set()))})')
    return q


def unsubscribe(tenant_id, device_id, q):
    """Remove a subscriber's queue."""
    key = (tenant_id, device_id)
    with _lock:
        if key in _subscribers:
            _subscribers[key].discard(q)
            if not _subscribers[key]:
                del _subscribers[key]
    logger.debug(f'SSE unsubscribe: tenant={tenant_id} device={device_id}')


def publish(tenant_id, device_id, event_type, data):
    """
    Publish an event to all subscribers for (tenant_id, device_id).
    Non-blocking: if a subscriber's queue is full, the event is dropped for that subscriber.

    Args:
        tenant_id: Tenant ID
        device_id: WecomDevice ID
        event_type: "message" | "typing" | "read_receipt"
        data: JSON-serializable dict with event payload
    """
    key = (tenant_id, device_id)
    event = {
        'type': event_type,
        'data': data,
        'timestamp': timezone.now().isoformat(),
    }
    with _lock:
        subscribers = list(_subscribers.get(key, set()))

    if not subscribers:
        return

    for q in subscribers:
        try:
            q.put_nowait(event)
        except queue.Full:
            # Drop oldest item and try again
            try:
                q.get_nowait()
                q.put_nowait(event)
            except Exception:
                pass

    logger.debug(f'SSE publish: tenant={tenant_id} device={device_id} type={event_type} subs={len(subscribers)}')


def publish_message_event(message):
    """
    Convenience: publish a new message event.
    Serializes the WecomMessage to dict using the serializer.
    """
    try:
        from .serializers import WecomMessageSerializer
        from .models import WecomMessage
        # Refresh from DB to get all fields populated
        if isinstance(message, WecomMessage):
            msg_data = WecomMessageSerializer(message).data
            tenant_id = message.tenant_id
            device_id = message.device_id
            publish(tenant_id, device_id, 'message', {
                'message': msg_data,
                'conversation_type': message.conversation_type,
                'contact_id': message.contact_id,
                'room_id': message.room_id,
            })
    except Exception as e:
        logger.warning(f'SSE publish_message_event failed: {e}')


def publish_typing_event(tenant_id, device_id, contact_id=None, room_id=None, conversation_type='contact'):
    """
    Publish a "typing" event (e.g. AI is composing a reply).
    Frontend shows "AI正在输入..." animation.
    """
    publish(tenant_id, device_id, 'typing', {
        'contact_id': contact_id,
        'room_id': room_id,
        'conversation_type': conversation_type,
    })


def publish_read_receipt(tenant_id, device_id, contact_id=None, room_id=None, conversation_type='contact'):
    """
    Publish a read receipt event.
    Frontend updates outbound messages to "read" status.
    """
    publish(tenant_id, device_id, 'read_receipt', {
        'contact_id': contact_id,
        'room_id': room_id,
        'conversation_type': conversation_type,
    })


def get_subscriber_count(tenant_id=None, device_id=None):
    """Return total subscriber count (for monitoring/debug)."""
    with _lock:
        if tenant_id and device_id:
            return len(_subscribers.get((tenant_id, device_id), set()))
        return sum(len(qs) for qs in _subscribers.values())

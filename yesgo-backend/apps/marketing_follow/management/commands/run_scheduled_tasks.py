"""
apps/marketing_follow/management/commands/run_scheduled_tasks.py
定时任务扫描器

每天 9:30 扫描所有 schedule 型 MarketingTask + no_contact_days 事件。
为符合条件的联系人创建 TaskExecution(pending)。

用法：
  python manage.py run_scheduled_tasks          # 立即执行扫描
  python manage.py run_scheduled_tasks --dry-run  # 只输出不创建

通常由 crontab 调用：
  30 9 * * * cd /home/web/twdanao/yesgo-backend && /home/web/twdanao/venv/bin/python3 manage.py run_scheduled_tasks
"""
import logging
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Q

from apps.marketing_follow.models import MarketingTask, TaskExecution, CustomerProfile, BroadcastTask
from apps.marketing_follow.event_dispatcher import dispatch_event, EVENT_NO_CONTACT_DAYS

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = '扫描定时型任务和 no_contact_days 事件，创建 TaskExecution'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='只输出将要执行的操作，不实际创建',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        now = timezone.now()
        created_total = 0

        self.stdout.write(self.style.SUCCESS(
            f'Scheduled task scanner started at {now:%Y-%m-%d %H:%M:%S} (dry_run={dry_run})'
        ))

        # ============================================================
        # 1. 扫描 schedule 型任务
        # ============================================================
        schedule_tasks = MarketingTask.objects.filter(
            trigger_type='schedule',
            status='active',
        ).filter(
            Q(valid_from__isnull=True) | Q(valid_from__lte=now)
        ).filter(
            Q(valid_until__isnull=True) | Q(valid_until__gte=now)
        )

        for task in schedule_tasks:
            config = task.trigger_config or {}
            conditions = config.get('conditions', {})
            days = conditions.get('days', 7)

            # 查找该设备下 N 天未联系的联系人
            threshold = now - timedelta(days=days)
            from apps.wecom.models import WecomContact, WecomMessage

            # 所有该设备的联系人，排除最近有消息的
            contacts = WecomContact.objects.filter(
                device=task.device,
                tenant=task.tenant,
                ai_hosted=True,
            )

            for contact in contacts:
                last_msg = WecomMessage.objects.filter(
                    contact=contact,
                ).order_by('-created_at').first()

                last_contacted = last_msg.created_at if last_msg else None

                if last_contacted and last_contacted > threshold:
                    continue  # 最近有联系，跳过

                # 检查是否已有 pending/running 的执行
                exists = TaskExecution.objects.filter(
                    task=task,
                    target_contact=contact,
                    status__in=['pending', 'running'],
                ).exists()
                if exists:
                    continue

                if dry_run:
                    self.stdout.write(f'  [DRY] would create: task={task.name} contact={contact}')
                    continue

                TaskExecution.objects.create(
                    task=task,
                    tenant=task.tenant,
                    target_contact=contact,
                    status='pending',
                    trigger_event={
                        'event_type': EVENT_NO_CONTACT_DAYS,
                        'event_data': {
                            'days': days,
                            'last_contacted_at': last_contacted.isoformat() if last_contacted else None,
                        },
                        'dispatched_at': now.isoformat(),
                        'source': 'run_scheduled_tasks',
                    },
                )
                created_total += 1

            self.stdout.write(
                f'  Schedule task "{task.name}": scanned {contacts.count()} contacts'
            )

        # ============================================================
        # 2. 扫描 no_contact_days 型 event 任务（兜底）
        # ============================================================
        event_no_contact_tasks = MarketingTask.objects.filter(
            trigger_type='event',
            status='active',
            trigger_config__event_type=EVENT_NO_CONTACT_DAYS,
        ).filter(
            Q(valid_from__isnull=True) | Q(valid_from__lte=now)
        ).filter(
            Q(valid_until__isnull=True) | Q(valid_until__gte=now)
        )

        for task in event_no_contact_tasks:
            config = task.trigger_config or {}
            conditions = config.get('conditions', {})
            days = conditions.get('days', 7)
            threshold = now - timedelta(days=days)

            from apps.wecom.models import WecomContact, WecomMessage

            contacts = WecomContact.objects.filter(
                device=task.device,
                tenant=task.tenant,
                ai_hosted=True,
            )

            for contact in contacts:
                last_msg = WecomMessage.objects.filter(
                    contact=contact,
                ).order_by('-created_at').first()

                last_contacted = last_msg.created_at if last_msg else None

                if last_contacted and last_contacted > threshold:
                    continue

                exists = TaskExecution.objects.filter(
                    task=task,
                    target_contact=contact,
                    status__in=['pending', 'running'],
                ).exists()
                if exists:
                    continue

                if dry_run:
                    self.stdout.write(f'  [DRY] would create: task={task.name} contact={contact}')
                    continue

                TaskExecution.objects.create(
                    task=task,
                    tenant=task.tenant,
                    target_contact=contact,
                    status='pending',
                    trigger_event={
                        'event_type': EVENT_NO_CONTACT_DAYS,
                        'event_data': {
                            'days': days,
                            'last_contacted_at': last_contacted.isoformat() if last_contacted else None,
                        },
                        'dispatched_at': now.isoformat(),
                        'source': 'run_scheduled_tasks',
                    },
                )
                created_total += 1

            self.stdout.write(
                f'  Event task "{task.name}" (no_contact_days): scanned {contacts.count()} contacts'
            )

        # ============================================================
        # 3. 扫描定时群发任务（BroadcastTask.scheduled_at 到期）
        # ============================================================
        due_broadcasts = BroadcastTask.objects.filter(
            status='pending',
            scheduled_at__lte=now,
        )

        for bt in due_broadcasts:
            # 查找或创建载体 MarketingTask
            mt, created_mt = MarketingTask.objects.get_or_create(
                tenant=bt.tenant,
                device=bt.device,
                name=f'_broadcast_{bt.id}',
                defaults={
                    'trigger_type': 'manual',
                    'action_type': 'broadcast',
                    'action_config': {
                        'material_type': bt.material_type,
                        'material_content': bt.material_content,
                        'filter_tags': bt.filter_tags,
                        'filter_conditions': bt.filter_conditions,
                    },
                    'status': 'active',
                },
            )

            pending_recipients = bt.recipients.filter(status='pending')
            bt_exec_count = 0
            for recipient in pending_recipients:
                exists = TaskExecution.objects.filter(
                    task=mt,
                    target_contact=recipient.contact,
                    status__in=['pending', 'running'],
                ).exists()
                if exists:
                    continue

                if dry_run:
                    self.stdout.write(f'  [DRY] would create broadcast exec: task={bt.name} contact={recipient.contact}')
                    continue

                TaskExecution.objects.create(
                    task=mt,
                    tenant=bt.tenant,
                    target_contact=recipient.contact,
                    status='pending',
                    trigger_event={
                        'broadcast_task_id': bt.id,
                        'scheduled_trigger': True,
                    },
                )
                bt_exec_count += 1
                created_total += 1

            if not dry_run and bt_exec_count > 0:
                bt.status = 'sending'
                bt.save(update_fields=['status'])

            self.stdout.write(
                f'  Broadcast task "{bt.name}": created {bt_exec_count} executions'
            )

        self.stdout.write(self.style.SUCCESS(
            f'Scheduled scan complete. Created {created_total} executions.'
        ))

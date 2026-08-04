"""
apps/marketing_follow/management/commands/run_task_runner.py
任务执行器轮询命令

每 10 秒轮询 pending 的 TaskExecution，按 action_type 分发到对应执行器。

用法：
  python manage.py run_task_runner          # 前台运行
  python manage.py run_task_runner --once   # 只执行一轮（用于 cron）
  python manage.py run_task_runner --interval 5  # 自定义轮询间隔
"""
import logging
import time
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.marketing_follow.models import TaskExecution

logger = logging.getLogger(__name__)

DEFAULT_INTERVAL = 10  # 秒
BATCH_SIZE = 20        # 每轮最多处理多少条


class Command(BaseCommand):
    help = '轮询 pending 的 TaskExecution 并执行'

    def add_arguments(self, parser):
        parser.add_argument(
            '--once', action='store_true',
            help='只执行一轮后退出（适合 cron 调用）',
        )
        parser.add_argument(
            '--interval', type=int, default=DEFAULT_INTERVAL,
            help=f'轮询间隔秒数（默认 {DEFAULT_INTERVAL}）',
        )

    def handle(self, *args, **options):
        once = options['once']
        interval = options['interval']

        self.stdout.write(self.style.SUCCESS(
            f'Task runner started (interval={interval}s, once={once})'
        ))

        while True:
            try:
                processed = self._run_batch()
                if processed > 0:
                    self.stdout.write(
                        f'[{timezone.now():%H:%M:%S}] Processed {processed} executions'
                    )
            except Exception as e:
                logger.exception(f'Task runner batch error: {e}')
                self.stderr.write(self.style.ERROR(f'Batch error: {e}'))

            if once:
                break

            time.sleep(interval)

    def _run_batch(self) -> int:
        """执行一批 pending 任务，返回处理数量。"""
        pending = TaskExecution.objects.filter(
            status='pending',
        ).order_by('created_at')[:BATCH_SIZE]

        count = 0
        for execution in pending:
            # 原子性锁定：只有 pending 才更新为 running
            updated = TaskExecution.objects.filter(
                id=execution.id, status='pending',
            ).update(status='running', started_at=timezone.now())

            if updated == 0:
                continue  # 已被其他进程抢走

            # 重新加载
            execution.refresh_from_db()

            action_type = execution.task.action_type
            try:
                if action_type == 'proactive_follow':
                    from apps.marketing_follow.proactive_executor import execute_proactive_follow
                    execute_proactive_follow(execution)
                elif action_type == 'broadcast':
                    from apps.marketing_follow.broadcast_executor import execute_broadcast
                    execute_broadcast(execution)
                elif action_type == 'moments':
                    logger.info(f'[TaskRunner] moments not yet implemented, skipping exec={execution.id}')
                    TaskExecution.objects.filter(id=execution.id).update(
                        status='skipped', error='moments executor not yet implemented',
                        completed_at=timezone.now(),
                    )
                else:
                    TaskExecution.objects.filter(id=execution.id).update(
                        status='skipped', error=f'unknown action_type: {action_type}',
                        completed_at=timezone.now(),
                    )
            except Exception as e:
                logger.exception(f'[TaskRunner] Execution {execution.id} failed: {e}')
                TaskExecution.objects.filter(id=execution.id).update(
                    status='failed', error=str(e)[:500],
                    completed_at=timezone.now(),
                )

            count += 1

        return count

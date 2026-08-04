"""
apps/wecom/management/commands/fix_unknown_video_messages.py
修复历史未知视频消息

将之前被保存为 file/unknown 的入站视频消息（msgType=22/23/43/103）重新识别为 video，
并尝试下载视频文件。

用法：
  python manage.py fix_unknown_video_messages [--dry-run]
"""
import logging
import os
import re
import urllib.request
import uuid

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.wecom.models import WecomMessage, WecomMediaFile
from apps.wecom.qiwei_client import get_qiwei_client

logger = logging.getLogger(__name__)

VIDEO_MSG_TYPES = (22, 23, 43, 103)


class Command(BaseCommand):
    help = '重新识别并修复历史未知视频消息（msgType=22/23/43/103）'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='只打印，不修改数据库'
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        # 查找 content 形如 [未知消息(type=103)] 的入站消息
        pattern = re.compile(r'\[未知消息\(type=(\d+)\)\]')
        candidates = WecomMessage.objects.filter(
            direction='inbound',
            msg_type='file',
            content__startswith='[未知消息(type='
        )

        fixed = 0
        downloaded = 0
        failed = 0

        for msg in candidates.iterator():
            m = pattern.match(msg.content or '')
            if not m:
                continue
            msg_type_val = int(m.group(1))
            if msg_type_val not in VIDEO_MSG_TYPES:
                continue

            raw = msg.raw_data or {}
            msg_data = raw.get('msgData', {}) or {}

            # 尝试从 raw_data 提取文件信息
            file_id = ''
            file_aes_key = ''
            file_md5 = ''
            file_size = 0
            play_length = 0
            file_http_url = ''

            if isinstance(msg_data, dict):
                file_id = msg_data.get('fileId', '') or msg_data.get('fileid', '')
                file_aes_key = msg_data.get('fileAesKey', '') or msg_data.get('fileAeskey', '')
                file_md5 = msg_data.get('fileMd5', '') or msg_data.get('filemd5', '')
                file_size = msg_data.get('fileSize', 0) or msg_data.get('filesize', 0)
                play_length = msg_data.get('playLength', 0) or msg_data.get('play_length', 0) or msg_data.get('duration', 0)
                # msgType=103 个微视频使用 fileHttpUrl 直接 HTTPS 下载
                file_http_url = msg_data.get('fileHttpUrl', '') or ''

            if not file_id:
                file_id = raw.get('fileId', '')
            if not file_aes_key:
                file_aes_key = raw.get('fileAesKey', '')
            if not file_md5:
                file_md5 = raw.get('fileMd5', '')
            if not file_size:
                file_size = raw.get('fileSize', 0) or raw.get('videoSize', 0)
            if not play_length:
                play_length = raw.get('playLength', 0) or raw.get('duration', 0)
            if not file_http_url:
                file_http_url = raw.get('fileHttpUrl', '')

            self.stdout.write(
                f'准备修复 msg={msg.id}, type={msg_type_val}, file_id={file_id[:16] or "无"}, '
                f'file_http_url={"有" if file_http_url else "无"}, play_length={play_length}'
            )

            if dry_run:
                continue

            media_file = msg.media_file

            # 如果还没有媒体文件，尝试下载
            # 路径 A：fileId → QiWei wxWorkDownload
            if not media_file and file_id and msg.device:
                try:
                    client = get_qiwei_client(msg.device)
                    download_result = client.download_media_file(
                        file_id, file_aes_key=file_aes_key, file_md5=file_md5,
                        file_size=file_size, file_type=5, guid=msg.device.guid,
                    )
                    cloud_url = download_result.get('cloudUrl', '')
                    if cloud_url:
                        upload_dir = os.path.join(settings.MEDIA_ROOT, 'wecom', 'uploads')
                        os.makedirs(upload_dir, exist_ok=True)
                        mp4_name = f'{uuid.uuid4().hex}.mp4'
                        mp4_path = os.path.join(upload_dir, mp4_name)
                        urllib.request.urlretrieve(cloud_url, mp4_path)
                        base_url = getattr(settings, 'SITE_BASE_URL', '').rstrip('/')
                        playable_url = f'{base_url}{settings.MEDIA_URL}wecom/uploads/{mp4_name}'
                        media_file = WecomMediaFile.objects.create(
                            tenant=msg.tenant,
                            file_type='video',
                            qiwe_file_id=file_id,
                            local_path=f'wecom/uploads/{mp4_name}',
                            url=playable_url,
                        )
                        downloaded += 1
                    else:
                        self.stdout.write(f'  msg={msg.id} fileId 路径返回空 cloudUrl，尝试 fileHttpUrl')
                except Exception as e:
                    self.stdout.write(f'  msg={msg.id} fileId 路径失败: {e}，尝试 fileHttpUrl')

            # 路径 B：fileHttpUrl → 直接 HTTPS 下载（msgType=103）
            if not media_file and file_http_url:
                try:
                    upload_dir = os.path.join(settings.MEDIA_ROOT, 'wecom', 'uploads')
                    os.makedirs(upload_dir, exist_ok=True)
                    mp4_name = f'{uuid.uuid4().hex}.mp4'
                    mp4_path = os.path.join(upload_dir, mp4_name)

                    req = urllib.request.Request(file_http_url, headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    })
                    with urllib.request.urlopen(req, timeout=60) as resp:
                        with open(mp4_path, 'wb') as f:
                            f.write(resp.read())

                    file_size_actual = os.path.getsize(mp4_path)
                    base_url = getattr(settings, 'SITE_BASE_URL', '').rstrip('/')
                    playable_url = f'{base_url}{settings.MEDIA_URL}wecom/uploads/{mp4_name}'
                    media_file = WecomMediaFile.objects.create(
                        tenant=msg.tenant,
                        file_type='video',
                        qiwe_file_id=file_http_url[-32:] if len(file_http_url) > 32 else file_http_url,
                        local_path=f'wecom/uploads/{mp4_name}',
                        url=playable_url,
                    )
                    downloaded += 1
                    self.stdout.write(f'  msg={msg.id} fileHttpUrl 下载成功 ({file_size_actual} bytes)')
                except Exception as e:
                    failed += 1
                    logger.warning(f'msg={msg.id} failed to download video via fileHttpUrl: {e}')

            if not media_file and not file_id and not file_http_url:
                failed += 1
                self.stdout.write(f'  msg={msg.id} 无 fileId 也无 fileHttpUrl，无法下载')

            msg.msg_type = 'video'
            msg.content = f'[视频] {play_length}秒' if play_length else '[视频]'
            if media_file and not msg.media_file_id:
                msg.media_file = media_file
            msg.save(update_fields=['msg_type', 'content', 'media_file'])
            fixed += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'完成：扫描 {candidates.count()} 条候选，修复 {fixed} 条，成功下载 {downloaded} 个，失败 {failed} 个。'
            )
        )

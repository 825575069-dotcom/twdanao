"""
Vosk 离线语音识别服务
- 首次调用时加载模型并缓存（进程级单例）
- 支持任意音频格式（通过 pydub + ffmpeg 转换为 WAV 16kHz mono）
"""

import io
import os
import json
import logging
import tempfile
import subprocess

logger = logging.getLogger(__name__)

# Vosk 模型缓存
_vosk_model = None
_vosk_recognizer = None


def _get_model():
    """惰性加载 Vosk 中文小模型，进程级缓存"""
    global _vosk_model
    if _vosk_model is not None:
        return _vosk_model

    try:
        from vosk import Model, KaldiRecognizer, SetLogLevel
    except ImportError:
        raise RuntimeError("vosk 库未安装，请在服务器执行 pip install vosk")

    SetLogLevel(-1)  # 关闭 Vosk 日志

    # 模型路径：优先环境变量，其次默认目录
    model_path = os.environ.get(
        'VOSK_MODEL_PATH',
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'vosk-model-small-cn-0.22')
    )

    if not os.path.isdir(model_path):
        raise RuntimeError(f"Vosk 模型目录不存在: {model_path}，请下载 vosk-model-small-cn-0.22")

    logger.info("正在加载 Vosk 中文模型: %s", model_path)
    _vosk_model = Model(model_path)
    logger.info("Vosk 模型加载完成")
    return _vosk_model


def _get_ffmpeg_path():
    """获取 ffmpeg 可执行文件路径，优先使用系统 ffmpeg，回退到 imageio-ffmpeg"""
    # 尝试系统 ffmpeg
    try:
        result = subprocess.run(['which', 'ffmpeg'], capture_output=True, timeout=5)
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.decode().strip()
    except Exception:
        pass

    # 回退到 imageio-ffmpeg（pip 包，自带静态二进制）
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        pass

    return 'ffmpeg'  # 最后回退


def _convert_to_wav(audio_bytes: bytes, input_format: str = 'webm') -> bytes:
    """
    将任意音频格式转换为 WAV 16kHz mono 16-bit
    优先使用 ffmpeg（通过 imageio-ffmpeg 或系统安装），回退到 pydub
    """
    ffmpeg_path = _get_ffmpeg_path()

    # 优先使用 ffmpeg 命令行直接转换
    try:
        with tempfile.NamedTemporaryFile(suffix=f'.{input_format}', delete=False) as tmp_in:
            tmp_in.write(audio_bytes)
            tmp_in_path = tmp_in.name

        tmp_out_path = tmp_in_path + '.wav'

        result = subprocess.run(
            [
                ffmpeg_path, '-y',
                '-i', tmp_in_path,
                '-ar', '16000',     # 采样率 16kHz
                '-ac', '1',          # 单声道
                '-f', 'wav',         # 输出 WAV
                '-loglevel', 'error',
                tmp_out_path
            ],
            capture_output=True,
            timeout=30
        )

        if result.returncode == 0 and os.path.exists(tmp_out_path):
            with open(tmp_out_path, 'rb') as f:
                wav_bytes = f.read()
            os.unlink(tmp_in_path)
            os.unlink(tmp_out_path)
            return wav_bytes

        logger.warning("ffmpeg 转换失败 (rc=%d): %s", result.returncode, result.stderr.decode('utf-8', errors='replace'))
    except FileNotFoundError:
        logger.warning("ffmpeg 未安装，尝试使用 pydub 回退")
    except Exception as e:
        logger.warning("ffmpeg 转换异常: %s", e)
    finally:
        if 'tmp_in_path' in locals() and os.path.exists(tmp_in_path):
            try:
                os.unlink(tmp_in_path)
            except Exception:
                pass
        if 'tmp_out_path' in locals() and os.path.exists(tmp_out_path):
            try:
                os.unlink(tmp_out_path)
            except Exception:
                pass

    # 回退到 pydub（依赖 ffmpeg/avconv）
    from pydub import AudioSegment
    audio = AudioSegment.from_file(io.BytesIO(audio_bytes), format=input_format)
    audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
    buf = io.BytesIO()
    audio.export(buf, format='wav')
    return buf.getvalue()


def transcribe_audio(audio_bytes: bytes, input_format: str = 'webm') -> str:
    """
    将音频字节流转写为文本

    Args:
        audio_bytes: 音频文件的二进制内容
        input_format: 输入音频格式（webm/wav/mp3 等）

    Returns:
        识别出的文本
    """
    global _vosk_recognizer

    model = _get_model()

    # 每次识别创建新的 Recognizer（轻量级，避免状态残留）
    from vosk import KaldiRecognizer
    rec = KaldiRecognizer(model, 16000)

    # 转换为 WAV
    wav_bytes = _convert_to_wav(audio_bytes, input_format)

    # 跳过 WAV 头部（44 字节）
    rec.AcceptWaveform(wav_bytes[44:])

    result = json.loads(rec.FinalResult())
    text = result.get('text', '').strip()

    logger.info("STT 转写完成: %s", text[:100] if text else '(空)')
    return text

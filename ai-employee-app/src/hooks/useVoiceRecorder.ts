import { useRef, useState, useCallback } from 'react'
import { getApiClient } from '../lib/api'

/**
 * 语音录制 + 后端 Vosk 转写 Hook
 *
 * 工作流：
 * 1. 点击麦克风 → getUserMedia 获取麦克风流
 * 2. MediaRecorder 录制为 WebM 音频
 * 3. 再次点击 / 自动停止 → 发送音频到后端 /api/v1/chat/stt/
 * 4. 后端用 Vosk 离线识别 → 返回文本
 *
 * 同时兼容浏览器环境：
 * - Electron → MediaRecorder + 后端 STT
 * - Chrome/Edge → 优先使用 webkitSpeechRecognition（实时转写），回退到 MediaRecorder
 */

type STTCallback = (text: string) => void

interface UseVoiceRecorderOptions {
  /** 识别成功后回调 */
  onTranscript: STTCallback
  /** 识别出错回调 */
  onError?: (msg: string) => void
  /** 是否使用浏览器原生 Speech API（网页版优先），默认 true
   *  Electron 环境自动忽略此选项，使用 MediaRecorder + 后端 STT
   */
  preferWebSpeech?: boolean
}

/** 写入诊断日志（Electron 写入文件，浏览器打印到 console） */
async function diagLog(label: string, data?: unknown) {
  try {
    const payload = typeof data === 'object' ? JSON.stringify(data) : String(data ?? '')
    const line = `[voice] ${label} ${payload}`
    if (typeof window !== 'undefined' && (window as any).appAPI?.logToFile) {
      await (window as any).appAPI.logToFile(line)
    }
    // eslint-disable-next-line no-console
    console.log(line)
  } catch {
    // ignore
  }
}

export function useVoiceRecorder({ onTranscript, onError, preferWebSpeech = true }: UseVoiceRecorderOptions) {
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<any>(null)
  const finalTextRef = useRef('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef<number>(0)

  /** 检测是否运行在 Electron 桌面端 */
  const isElectron = typeof window !== 'undefined' && !!(window as any).appAPI?.versions?.electron

  /** 发送音频到后端 STT 接口 */
  const sendToBackendSTT = useCallback(async (blob: Blob) => {
    setTranscribing(true)
    await diagLog('sendToBackendSTT start', { size: blob.size, type: blob.type })
    try {
      const api = getApiClient()
      const formData = new FormData()
      const ext = blob.type.includes('webm') ? 'webm' : blob.type.includes('mp4') ? 'mp4' : 'webm'
      formData.append('audio', blob, `recording.${ext}`)
      formData.append('format', ext)

      const baseUrl = (api as any).config?.baseUrl || ''
      const accessToken = (api as any).config?.accessToken || ''
      const tenantId = (api as any).config?.tenantId || ''

      const url = `${baseUrl}/chat/stt/`
      await diagLog('fetch url', { url: url.replace(/\/\/.*@/, '//***@'), tokenLen: accessToken.length, tenantId })

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
        },
        body: formData,
      })

      await diagLog('fetch status', { status: resp.status, ok: resp.ok })
      const data = await resp.json()
      await diagLog('fetch response', data)
      if (data.code === 0) {
        const text = data.data?.text || ''
        if (text.trim()) {
          onTranscript(text)
        } else {
          onError?.('未识别到语音内容，请检查麦克风是否正常工作')
        }
      } else {
        onError?.(data.msg || '语音识别失败')
      }
    } catch (err) {
      await diagLog('STT request error', err instanceof Error ? err.message : String(err))
      onError?.('语音识别请求失败，请检查网络')
    } finally {
      setTranscribing(false)
    }
  }, [onTranscript, onError])

  /** 停止 MediaRecorder 录音并发送转写 */
  const stopMediaRecording = useCallback(() => {
    setListening(false)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch (err) {
        diagLog('recorder.stop error', err instanceof Error ? err.message : String(err))
      }
    } else {
      // 没有活跃的 recorder，清理音轨
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  /** 启动 MediaRecorder 录音 */
  const startMediaRecording = useCallback(async () => {
    await diagLog('startMediaRecording called', { isElectron, ua: navigator.userAgent })
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      audioChunksRef.current = []
      startTimeRef.current = Date.now()

      const audioTrack = stream.getAudioTracks()[0]
      await diagLog('audio track info', {
        label: audioTrack?.label,
        muted: audioTrack?.muted,
        readyState: audioTrack?.readyState,
        settings: audioTrack?.getSettings?.()
      })

      // 选择浏览器支持的 MIME 类型
      const mimeTypeOrder = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg',
      ]
      let mimeType = ''
      for (const mt of mimeTypeOrder) {
        if (MediaRecorder.isTypeSupported(mt)) {
          mimeType = mt
          break
        }
      }
      await diagLog('selected mimeType', { mimeType, supported: mimeTypeOrder.filter(MediaRecorder.isTypeSupported) })

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      recorder.ondataavailable = (e) => {
        diagLog('ondataavailable', { size: e.data.size, type: e.data.type })
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      recorder.onerror = (e) => {
        diagLog('MediaRecorder error', (e as any).message || String(e))
        setListening(false)
        onError?.('录音出现错误，请重试')
      }

      recorder.onstop = () => {
        diagLog('recorder onstop', { chunks: audioChunksRef.current.length, duration: Date.now() - startTimeRef.current })
        // 停止所有音轨（必须在 onstop 中做，否则 blob 可能损坏）
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
          streamRef.current = null
        }

        const finalMimeType = mimeType || 'audio/webm'
        const blob = new Blob(audioChunksRef.current, { type: finalMimeType })
        // 即使没有数据也发给后端一次，让后端做最终判断；空音频后端会返回空字符串
        if (blob.size > 0) {
          sendToBackendSTT(blob)
        } else {
          diagLog('blob empty, no audio data', { size: blob.size })
          onError?.('未检测到音频输入，请检查麦克风权限或麦克风是否正常工作')
        }
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setListening(true)
      await diagLog('recorder started', { state: recorder.state })

      // 录音超过 30 秒自动停止，避免用户忘记关
      timeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          diagLog('recording auto stopped after 30s')
          stopMediaRecording()
        }
      }, 30000)
    } catch (err) {
      await diagLog('getUserMedia error', err instanceof Error ? err.message : String(err))
      onError?.('无法访问麦克风，请检查权限设置')
    }
  }, [sendToBackendSTT, onError, stopMediaRecording, isElectron])

  /** 启动浏览器原生 SpeechRecognition（网页版） */
  const startWebSpeech = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      onError?.('当前浏览器不支持语音输入，请使用 Chrome/Edge 浏览器')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.continuous = true
    recognition.interimResults = true
    recognitionRef.current = recognition

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      setListening(false)
      if (event.error === 'not-allowed') {
        onError?.('麦克风权限被拒绝')
      }
    }

    recognition.onresult = (event: any) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }
      if (final) {
        finalTextRef.current += final
        onTranscript(finalTextRef.current + interim)
      } else if (interim) {
        onTranscript(finalTextRef.current + interim)
      }
    }

    finalTextRef.current = ''
    recognition.start()
  }, [onTranscript, onError])

  /** 切换录音状态 */
  const toggleListening = useCallback(() => {
    if (listening) {
      // 停止
      if (isElectron || !preferWebSpeech) {
        stopMediaRecording()
      } else {
        recognitionRef.current?.stop()
        setListening(false)
      }
    } else {
      // 启动
      if (isElectron || !preferWebSpeech) {
        startMediaRecording()
      } else {
        startWebSpeech()
      }
    }
  }, [listening, isElectron, preferWebSpeech, stopMediaRecording, startMediaRecording, startWebSpeech])

  /** 停止录音 */
  const stopListening = useCallback(() => {
    if (listening) {
      if (isElectron || !preferWebSpeech) {
        stopMediaRecording()
      } else {
        recognitionRef.current?.stop()
        setListening(false)
      }
    }
  }, [listening, isElectron, preferWebSpeech, stopMediaRecording])

  return {
    listening,
    transcribing,
    toggleListening,
    stopListening,
  }
}

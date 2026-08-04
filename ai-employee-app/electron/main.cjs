const { app, BrowserWindow, shell, nativeTheme, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development'
const DEV_URL = 'http://127.0.0.1:5180'

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 920,
    minHeight: 600,
    show: false,
    backgroundColor: '#ffffff',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    frame: process.platform === 'darwin',
    trafficLightPosition: { x: 16, y: 18 },
    title: 'AI 数字员工',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })

  // 强制深色主题
  nativeTheme.themeSource = 'dark'

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // 外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL(DEV_URL)
    // 开发环境打开 DevTools
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

// 写入渲染进程日志到本地文件（用于排查语音等问题）
function getLogPath() {
  return path.join(app.getPath('userData'), 'renderer-debug.log')
}

app.whenReady().then(() => {
  // IPC：渲染进程写入日志
  ipcMain.handle('log-to-file', async (_event, message) => {
    try {
      const logPath = getLogPath()
      const line = `[${new Date().toISOString()}] ${message}\n`
      fs.appendFileSync(logPath, line, 'utf-8')
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // IPC：获取日志文件路径
  ipcMain.handle('get-logs-path', () => getLogPath())

  // 配置麦克风权限：Electron 默认会拦截 getUserMedia，需要显式授权
  const { session } = require('electron')
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const logPath = getLogPath()
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] PermissionRequest: ${permission}\n`, 'utf-8')
    if (permission === 'media' || permission === 'microphone') {
      // 允许麦克风访问
      callback(true)
    } else {
      callback(false)
    }
  })

  // 同时设置权限检查处理器（某些 Chromium 版本需要）
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media' || permission === 'microphone') {
      return true
    }
    return false
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

const { app, BrowserWindow, shell, nativeTheme } = require('electron')
const path = require('path')

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
    backgroundColor: '#0b0d12',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    frame: process.platform === 'darwin',
    trafficLightPosition: { x: 16, y: 18 },
    vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
    visualEffectState: 'active',
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
    // 临时打开 DevTools 便于排查黑屏问题
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

const { contextBridge, ipcRenderer } = require('electron')

// 暴露给渲染进程的安全 API（后续业务功能在此扩展）
contextBridge.exposeInMainWorld('appAPI', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },
  // 写入日志到本地文件（排查语音等问题）
  logToFile: (message) => ipcRenderer.invoke('log-to-file', message),
  // 获取日志文件路径
  getLogsPath: () => ipcRenderer.invoke('get-logs-path')
})

const { contextBridge } = require('electron')

// 暴露给渲染进程的安全 API（后续业务功能在此扩展）
contextBridge.exposeInMainWorld('appAPI', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },
  // 占位：后续接入业务系统时在此添加 IPC 通道
})

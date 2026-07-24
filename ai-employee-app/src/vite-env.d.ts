/// <reference types="vite/client" />

interface AppAPI {
  platform: string
  versions: {
    electron: string
    chrome: string
    node: string
  }
}

interface Window {
  appAPI?: AppAPI
}

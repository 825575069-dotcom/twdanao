import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

declare global {
  interface Window {
    __H5_MODE__?: boolean
  }
}

const isH5 = !!window.__H5_MODE__

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App isH5={isH5} />
  </React.StrictMode>
)

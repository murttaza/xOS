import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AuthGate } from './components/AuthGate'
import { ToastContainer } from './components/ui/toast'
import './index.css'

// Mark web environment for CSS (Electron needs overflow:hidden, web needs scroll)
if (!window.ipcRenderer) {
  document.documentElement.classList.add('web');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthGate>
      <App />
      <ToastContainer />
    </AuthGate>
  </React.StrictMode>,
)

// Use contextBridge (Electron only)
if (window.ipcRenderer) {
  window.ipcRenderer.on('main-process-message', (_event, message) => {
    console.log(message)
  })
}

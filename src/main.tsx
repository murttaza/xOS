import React from 'react'
import ReactDOM from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import App from './App.tsx'
import { AuthGate } from './components/AuthGate'
import { ToastContainer } from './components/ui/toast'
import { ConfirmProvider } from './components/ui/confirm-dialog'
import '@fontsource-variable/outfit'
import './index.css'

// Mark web environment for CSS (Electron needs overflow:hidden, web needs scroll)
if (!window.ipcRenderer) {
  document.documentElement.classList.add('web');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* reducedMotion="user" disables framer-motion transform/layout animation
        when the OS asks for reduced motion (CSS side handled in index.css) */}
    <MotionConfig reducedMotion="user">
      <AuthGate>
        <App />
        <ToastContainer />
        <ConfirmProvider />
      </AuthGate>
    </MotionConfig>
  </React.StrictMode>,
)

// Use contextBridge (Electron only)
if (window.ipcRenderer) {
  window.ipcRenderer.on('main-process-message', (_event, message) => {
    console.log(message)
  })
}

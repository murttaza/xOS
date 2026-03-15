/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface Window {
    ipcRenderer: {
        on(...args: Parameters<typeof import('electron').ipcRenderer.on>): () => void
        off(...args: Parameters<typeof import('electron').ipcRenderer.off>): void
        send(...args: Parameters<typeof import('electron').ipcRenderer.send>): void
        invoke(...args: Parameters<typeof import('electron').ipcRenderer.invoke>): Promise<unknown>
    }
}


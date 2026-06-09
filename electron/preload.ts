import { ipcRenderer, contextBridge } from 'electron'
import { WINDOW_CHANNEL_LISTS, WINDOW_KIND_ARG } from '../src/shared/ipc-types'

// ── Allow-listed IPC bridge ─────────────────────────────────────────
// The renderer only ever gets the channels listed for its window type in
// src/shared/ipc-types.ts. Anything else is rejected here, so renderer
// compromise (XSS, malicious dependency) cannot reach arbitrary main-process
// handlers — most importantly the password vault.
//
// The window type is passed by the main process via additionalArguments.

const kindArg = process.argv.find((a) => a.startsWith(WINDOW_KIND_ARG))
const windowKind = kindArg ? kindArg.slice(WINDOW_KIND_ARG.length) : 'unknown'
const lists = WINDOW_CHANNEL_LISTS[windowKind] ?? { invoke: [], send: [], listen: [] }

const invokeAllowed = new Set(lists.invoke)
const sendAllowed = new Set(lists.send)
const listenAllowed = new Set(lists.listen)

if (!WINDOW_CHANNEL_LISTS[windowKind]) {
  console.error(`[preload] unknown window kind "${windowKind}" — all IPC channels disabled`)
}

contextBridge.exposeInMainWorld('ipcRenderer', {
  on(channel: string, listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void) {
    if (!listenAllowed.has(channel)) {
      console.warn(`[preload] blocked listener on channel "${channel}"`)
      return () => { /* no-op unsubscribe */ }
    }
    const subscription = (event: Electron.IpcRendererEvent, ...args: unknown[]) => listener(event, ...args)
    ipcRenderer.on(channel, subscription)
    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  },
  off(channel: string, listener: (...args: unknown[]) => void) {
    if (!listenAllowed.has(channel)) return
    ipcRenderer.off(channel, listener)
  },
  send(channel: string, ...args: unknown[]) {
    if (!sendAllowed.has(channel)) {
      console.warn(`[preload] blocked send on channel "${channel}"`)
      return
    }
    ipcRenderer.send(channel, ...args)
  },
  invoke(channel: string, ...args: unknown[]) {
    if (!invokeAllowed.has(channel)) {
      return Promise.reject(new Error(`IPC channel "${channel}" is not allowed`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },
})

export const isElectron = typeof window !== 'undefined' && !!window.ipcRenderer;
export const isWeb = !isElectron;

/**
 * Tell the other windows (widget, tray, palette) that this window changed data,
 * so they refresh promptly instead of waiting for their next poll. No-op on web.
 * The main process rebroadcasts `data-changed` to every window except the sender.
 */
export function notifyDataChanged() {
    if (isElectron && window.ipcRenderer) {
        window.ipcRenderer.send('data-changed', { source: 'app' });
    }
}

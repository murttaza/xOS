export const isElectron = typeof window !== 'undefined' && !!window.ipcRenderer;
export const isWeb = !isElectron;

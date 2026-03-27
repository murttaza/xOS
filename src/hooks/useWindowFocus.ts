import { useEffect, useState } from 'react';
import { isElectron } from '../lib/platform';

/**
 * Hook that tracks whether the window is focused.
 * On Electron, uses IPC events from the main process.
 * On web, uses the standard document visibility API.
 */
export function useWindowFocus() {
    const [isFocused, setIsFocused] = useState(true);

    useEffect(() => {
        if (isElectron) {
            const removeListener = window.ipcRenderer.on('window-focus-state', (_event: unknown, focused: boolean) => {
                setIsFocused(focused);
            });
            return () => { removeListener(); };
        } else {
            const handler = () => setIsFocused(!document.hidden);
            document.addEventListener('visibilitychange', handler);
            return () => document.removeEventListener('visibilitychange', handler);
        }
    }, []);

    return isFocused;
}

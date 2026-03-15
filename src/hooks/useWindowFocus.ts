import { useEffect, useState } from 'react';

/**
 * Hook that tracks whether the Electron window is focused.
 * Components can use this to pause expensive work (animations, visualizers)
 * when the window is not visible, dramatically reducing CPU/GPU usage.
 */
export function useWindowFocus() {
    const [isFocused, setIsFocused] = useState(true);

    useEffect(() => {
        const removeListener = window.ipcRenderer.on('window-focus-state', (_event: unknown, focused: boolean) => {
            setIsFocused(focused);
        });

        return () => {
            removeListener();
        };
    }, []);

    return isFocused;
}

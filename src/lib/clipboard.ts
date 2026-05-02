import { isElectron } from './platform';
import { IpcChannels } from '@/shared/ipc-types';

export async function writeClipboard(text: string): Promise<boolean> {
    if (isElectron && window.ipcRenderer) {
        try {
            const ok = (await window.ipcRenderer.invoke(IpcChannels.ClipboardWrite, text)) as boolean;
            if (ok) return true;
        } catch (err) {
            console.error('Electron clipboard write failed, falling back:', err);
        }
    }
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('navigator.clipboard.writeText failed:', err);
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch (err2) {
            console.error('execCommand copy fallback failed:', err2);
            return false;
        }
    }
}

export async function clearClipboardIfMatch(text: string): Promise<void> {
    if (isElectron && window.ipcRenderer) {
        try {
            await window.ipcRenderer.invoke(IpcChannels.ClipboardClearIfMatch, text);
            return;
        } catch (err) {
            console.error('Electron clipboard clear failed:', err);
        }
    }
    try {
        const current = await navigator.clipboard.readText();
        if (current === text) await navigator.clipboard.writeText('');
    } catch {
        // Best-effort only
    }
}

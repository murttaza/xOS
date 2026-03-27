import type { ApiBackend } from './adapters/types';

let _backend: ApiBackend | null = null;

async function getBackend(): Promise<ApiBackend> {
    if (_backend) return _backend;

    // Always use Supabase — both Electron and web share the same cloud DB
    const { supabaseBackend } = await import('./adapters/supabase');
    _backend = supabaseBackend;

    return _backend;
}

// Proxy that lazily resolves the backend on first call
export const api = new Proxy({} as ApiBackend, {
    get(_target, prop: string) {
        return (...args: any[]) =>
            getBackend().then((backend) => (backend as any)[prop](...args));
    },
});

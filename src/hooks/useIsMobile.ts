import { useEffect, useState } from 'react';

export function useIsMobile(query = '(max-width: 639px)'): boolean {
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia(query).matches
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia(query);
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [query]);

    return isMobile;
}

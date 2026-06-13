import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { isOwnerAccount } from '@/lib/brand';

/** Whether the signed-in account is the project owner's (gates the Arabic
 *  personal flourishes). One hook instead of three copies of the same
 *  getUser() effect — and the one place the check can't be forgotten. */
export function useIsOwner(): boolean {
    const [isOwner, setIsOwner] = useState(false);
    useEffect(() => {
        let cancelled = false;
        supabase.auth.getUser()
            .then(({ data }) => { if (!cancelled) setIsOwner(isOwnerAccount(data.user?.email)); })
            .catch(() => { if (!cancelled) setIsOwner(false); });
        return () => { cancelled = true; };
    }, []);
    return isOwner;
}

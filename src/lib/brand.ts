// Single source of truth for the user-facing product name.
// The installer (electron-builder.json5 productName), window titles
// (index.html/palette.html/widget.html), PWA manifest, and tray must all
// agree with this — update them together if the brand ever changes.
export const APP_NAME = 'mOS';

/** Public releases page — the web build's "Download Desktop App" link.
 *  (Yes, the GitHub handle really is spelled "murttaza".) */
export const RELEASES_URL = 'https://github.com/murttaza/xOS/releases/latest';

/**
 * Personal flourishes (the Arabic signature/meem) only render for the
 * project owner's account — strangers get the neutral brand. Set
 * VITE_OWNER_EMAIL in .env to enable them; leave unset in distributed
 * builds for a fully neutral product.
 */
export function isOwnerAccount(email: string | null | undefined): boolean {
    const owner = import.meta.env.VITE_OWNER_EMAIL as string | undefined;
    return !!owner && !!email && email.toLowerCase() === owner.toLowerCase();
}

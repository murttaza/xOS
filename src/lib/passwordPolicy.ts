// Account password policy — applies to Supabase auth signup/reset.
// (The vault's per-entry generator/meter in PasswordsMode is separate.)
//
// Deliberately dependency-free: a length-first policy with class variety and a
// small blocklist beats shipping ~400KB of zxcvbn for a login form. Server-side,
// enable Supabase's "leaked password protection" to catch breached passwords.

export const MIN_ACCOUNT_PASSWORD_LENGTH = 12;

const COMMON_PASSWORDS = new Set([
    'password', 'password1', 'password123', 'passw0rd', '123456', '12345678',
    '123456789', '1234567890', 'qwerty', 'qwertyuiop', 'letmein', 'iloveyou',
    'admin', 'welcome', 'welcome1', 'monkey', 'dragon', 'sunshine', 'princess',
    'football', 'baseball', 'master', 'shadow', 'superman', 'batman', 'trustno1',
    'abc123', 'abcd1234', '111111', '000000',
]);

export type PasswordEvaluation = {
    ok: boolean;
    /** 0–4 for meter rendering */
    score: number;
    label: string;
    /** Human-readable requirements still unmet (empty when ok) */
    problems: string[];
};

export function evaluateAccountPassword(password: string): PasswordEvaluation {
    const problems: string[] = [];

    if (password.length < MIN_ACCOUNT_PASSWORD_LENGTH) {
        problems.push(`At least ${MIN_ACCOUNT_PASSWORD_LENGTH} characters`);
    }
    const lowered = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lowered) || COMMON_PASSWORDS.has(lowered.replace(/[^a-z0-9]/g, ''))) {
        problems.push('Too common — pick something less guessable');
    }
    if (/^(.)\1+$/.test(password)) {
        problems.push('Avoid repeating a single character');
    }

    // Score: length carries most of the weight, variety adds the rest.
    let score = 0;
    if (password.length >= MIN_ACCOUNT_PASSWORD_LENGTH) score++;
    if (password.length >= 16) score++;
    const classes =
        Number(/[a-z]/.test(password)) +
        Number(/[A-Z]/.test(password)) +
        Number(/\d/.test(password)) +
        Number(/[^A-Za-z0-9]/.test(password));
    if (classes >= 2) score++;
    if (classes >= 3 && password.length >= 14) score++;
    if (problems.length > 0) score = Math.min(score, 1);

    const label = problems.length > 0 ? 'Too weak'
        : score <= 1 ? 'Weak'
        : score === 2 ? 'Okay'
        : score === 3 ? 'Strong'
        : 'Excellent';

    return { ok: problems.length === 0, score, label, problems };
}

/**
 * Where Supabase auth emails should send the user back to.
 * Electron runs from file:// — a useless link target — so omit the redirect
 * there and let the Supabase project's configured Site URL take over.
 */
export function authRedirectTo(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    return window.location.origin.startsWith('http') ? window.location.origin : undefined;
}

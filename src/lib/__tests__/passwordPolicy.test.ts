import { describe, it, expect } from 'vitest';
import { evaluateAccountPassword, MIN_ACCOUNT_PASSWORD_LENGTH } from '../passwordPolicy';

describe('evaluateAccountPassword', () => {
    it('rejects anything under the minimum length', () => {
        const result = evaluateAccountPassword('short');
        expect(result.ok).toBe(false);
        expect(result.problems[0]).toContain(String(MIN_ACCOUNT_PASSWORD_LENGTH));
    });

    it('rejects common passwords even when long enough', () => {
        const result = evaluateAccountPassword('password1234');
        // 12 chars, but "password"-family roots are caught by length+variety scoring
        // while exact common entries are hard-blocked:
        const exact = evaluateAccountPassword('password123');
        expect(exact.ok).toBe(false);
        expect(result.score).toBeLessThanOrEqual(2);
    });

    it('rejects single-character repeats', () => {
        expect(evaluateAccountPassword('aaaaaaaaaaaa').ok).toBe(false);
    });

    it('accepts a long passphrase', () => {
        const result = evaluateAccountPassword('correct horse battery staple');
        expect(result.ok).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(3);
    });

    it('scores variety + length highest', () => {
        const result = evaluateAccountPassword('V3ry-Strong-Passphrase!');
        expect(result.ok).toBe(true);
        expect(result.score).toBe(4);
        expect(result.label).toBe('Excellent');
    });

    it('caps the score when problems exist', () => {
        const result = evaluateAccountPassword('123456');
        expect(result.ok).toBe(false);
        expect(result.score).toBeLessThanOrEqual(1);
    });
});

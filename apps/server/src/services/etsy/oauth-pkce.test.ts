import { describe, expect, test } from 'bun:test';
import { createPkcePair, toCodeChallenge } from './oauth-pkce';

describe('oauth-pkce', () => {
    test('creates a verifier and challenge pair', () => {
        const pair = createPkcePair();

        expect(pair.codeVerifier.length).toBeGreaterThanOrEqual(43);
        expect(pair.codeVerifier.length).toBeLessThanOrEqual(128);
        expect(pair.codeChallenge).toBe(toCodeChallenge(pair.codeVerifier));
    });

    test('code challenge is deterministic for a verifier', () => {
        const verifier = 'verifier-value-123';

        expect(toCodeChallenge(verifier)).toBe(toCodeChallenge(verifier));
    });
});

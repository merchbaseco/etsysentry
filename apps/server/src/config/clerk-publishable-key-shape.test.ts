import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../../../../.env.schema', import.meta.url), 'utf8');
const publishableKeyPattern = /pk_(?:test|live)_[A-Za-z0-9+/=]+/gu;
const base64PaddingPattern = /[=]+$/u;

const TEST_ARM_KEY = 'pk_test_ZXRzeXNlbnRyeS10ZXN0LmNsZXJrLmFjY291bnRzLmRldiQ';

// Clerk's own rules, from `@clerk/backend`'s `isPublishableKey`: the key splits
// into exactly three underscore-delimited parts, and the third base64-decodes
// to the instance's frontend domain with a single trailing `$`. A placeholder
// that fails any of these is not merely ugly — Clerk rejects it, so the test
// lane would run against an invalid-key code path production never reaches.
const describeKey = (key: string) => {
    const parts = key.split('_');
    const payload = parts[2] ?? '';
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    const domain = decoded.slice(0, -1);

    return {
        decoded,
        endsWithDollar: decoded.endsWith('$'),
        hasSingleDollar: !domain.includes('$'),
        // Round-trip, because base64 decoding silently tolerates junk: only a
        // faithful re-encode proves the payload was really base64.
        isBase64:
            Buffer.from(decoded, 'utf8').toString('base64').replace(base64PaddingPattern, '') ===
            payload.replace(base64PaddingPattern, ''),
        isDottedDomain: domain.includes('.'),
        partCount: parts.length,
    };
};

describe('committed Clerk publishable keys', () => {
    test('decode in every lifecycle arm, including the fake test one', () => {
        const keys = schema.match(publishableKeyPattern) ?? [];

        // Test and production are both committed literals; development
        // resolves from 1Password and so is not matched here.
        expect(keys.length).toBeGreaterThanOrEqual(2);

        for (const key of keys) {
            const shape = describeKey(key);

            expect(shape.partCount, `${key} must split into pk_<env>_<payload>`).toBe(3);
            expect(shape.isBase64, `${key} payload must be base64`).toBe(true);
            expect(shape.endsWithDollar, `${key} must decode to a domain ending in $`).toBe(true);
            expect(shape.hasSingleDollar, `${key} must decode with a single trailing $`).toBe(true);
            expect(shape.isDottedDomain, `${key} must decode to a dotted domain`).toBe(true);
        }
    });

    test('keep the test arm a fake domain rather than a real instance', () => {
        expect(schema).toContain(TEST_ARM_KEY);
        expect(describeKey(TEST_ARM_KEY).decoded).toBe('etsysentry-test.clerk.accounts.dev$');
    });
});

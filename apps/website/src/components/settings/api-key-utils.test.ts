import { describe, expect, test } from 'bun:test';
import type { ApiKeyRecord } from '@/lib/api-keys-api';
import { maskApiKeyValue, pickNewestActiveApiKey } from './api-key-utils';

const buildApiKeyRecord = (params: {
    createdAt: string;
    id: string;
    revokedAt?: string | null;
}): ApiKeyRecord => {
    return {
        accountId: 'account-1',
        createdAt: params.createdAt,
        id: params.id,
        keyPrefix: `esk_live_${params.id}`,
        lastUsedAt: null,
        name: 'API key',
        ownerClerkUserId: 'user-1',
        revokedAt: params.revokedAt ?? null,
        updatedAt: params.createdAt,
    };
};

describe('pickNewestActiveApiKey', () => {
    test('returns null when there are no active keys', () => {
        const result = pickNewestActiveApiKey([
            buildApiKeyRecord({
                createdAt: '2026-01-01T00:00:00.000Z',
                id: 'key-1',
                revokedAt: '2026-01-01T01:00:00.000Z',
            }),
        ]);

        expect(result).toBeNull();
    });

    test('returns newest non-revoked key', () => {
        const result = pickNewestActiveApiKey([
            buildApiKeyRecord({
                createdAt: '2026-01-01T00:00:00.000Z',
                id: 'key-1',
            }),
            buildApiKeyRecord({
                createdAt: '2026-01-03T00:00:00.000Z',
                id: 'key-3',
                revokedAt: '2026-01-03T01:00:00.000Z',
            }),
            buildApiKeyRecord({
                createdAt: '2026-01-02T00:00:00.000Z',
                id: 'key-2',
            }),
        ]);

        expect(result?.id).toBe('key-2');
    });
});

describe('maskApiKeyValue', () => {
    test('masks key and keeps head and tail visible for long values', () => {
        expect(maskApiKeyValue('esk_live_1234567890abcdef')).toBe('esk_liv**********cdef');
    });
});

import { describe, expect, test } from 'bun:test';
import type { ApiKeyRecord } from '@/lib/api-keys-api';
import { maskApiKeyValue, pickNewestApiKey } from './api-key-utils';

const buildApiKeyRecord = (params: { createdAt: string; id: string }): ApiKeyRecord => {
    return {
        accountId: 'account-1',
        createdAt: params.createdAt,
        id: params.id,
        keyPrefix: `esk_live_${params.id}`,
        lastUsedAt: null,
        name: 'API key',
        ownerClerkUserId: 'user-1',
        updatedAt: params.createdAt,
    };
};

describe('pickNewestApiKey', () => {
    test('returns null when there are no keys', () => {
        const result = pickNewestApiKey([]);

        expect(result).toBeNull();
    });

    test('returns newest key by created timestamp', () => {
        const result = pickNewestApiKey([
            buildApiKeyRecord({
                createdAt: '2026-01-01T00:00:00.000Z',
                id: 'key-1',
            }),
            buildApiKeyRecord({
                createdAt: '2026-01-02T00:00:00.000Z',
                id: 'key-2',
            }),
            buildApiKeyRecord({
                createdAt: '2026-01-03T00:00:00.000Z',
                id: 'key-3',
            }),
        ]);

        expect(result?.id).toBe('key-3');
    });
});

describe('maskApiKeyValue', () => {
    test('masks key and keeps head and tail visible for long values', () => {
        expect(maskApiKeyValue('esk_live_1234567890abcdef')).toBe('esk_liv**********cdef');
    });
});

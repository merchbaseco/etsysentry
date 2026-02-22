import { describe, expect, test } from 'bun:test';
import { EtsyOAuthStateStore } from './oauth-state-store';

describe('oauth-state-store', () => {
    test('issues and consumes a state one time', () => {
        const store = new EtsyOAuthStateStore(1000);
        const { state } = store.issue({
            clerkUserId: 'user-1',
            codeVerifier: 'abc123',
            tenantId: 'tenant-1'
        });

        expect(store.consume(state)).toEqual({
            clerkUserId: 'user-1',
            codeVerifier: 'abc123',
            tenantId: 'tenant-1'
        });
        expect(store.consume(state)).toBeNull();
    });

    test('expires states after ttl', async () => {
        const store = new EtsyOAuthStateStore(1);
        const { state } = store.issue({
            clerkUserId: 'user-1',
            codeVerifier: 'abc123',
            tenantId: 'tenant-1'
        });

        await Bun.sleep(2);

        expect(store.consume(state)).toBeNull();
    });
});

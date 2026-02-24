import { describe, expect, test } from 'bun:test';
import {
    emitEvent,
    onEvent
} from './emit-event';

describe('emitEvent', () => {
    test('emits invalidation events to subscribers', () => {
        const receivedEvents: unknown[] = [];
        const stopListening = onEvent((event) => {
            receivedEvents.push(event);
        });

        emitEvent({
            clerkUserId: 'user_123',
            queries: ['app.keywords.list', 'app.listings.list', 'app.logs.list'],
            accountId: 'tenant_123'
        });
        stopListening();

        expect(receivedEvents).toEqual([
            {
                clerkUserId: 'user_123',
                queries: ['app.keywords.list', 'app.listings.list', 'app.logs.list'],
                accountId: 'tenant_123'
            }
        ]);
    });

    test('rejects invalid query names', () => {
        expect(() => {
            emitEvent({
                clerkUserId: 'user_123',
                queries: ['invalid.query'] as unknown as (
                    'app.keywords.list' | 'app.listings.list' | 'app.logs.list'
                )[],
                accountId: 'tenant_123'
            });
        }).toThrow();
    });
});

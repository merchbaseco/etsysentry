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
            queries: ['app.keywords.list', 'app.listings.list', 'app.shops.list', 'app.logs.list'],
            accountId: 'tenant_123'
        });
        stopListening();

        expect(receivedEvents).toEqual([
            {
                queries: ['app.keywords.list', 'app.listings.list', 'app.shops.list', 'app.logs.list'],
                accountId: 'tenant_123'
            }
        ]);
    });

    test('rejects invalid query names', () => {
        expect(() => {
            emitEvent({
                queries: ['invalid.query'] as unknown as (
                    'app.keywords.list' | 'app.listings.list' | 'app.shops.list' | 'app.logs.list'
                )[],
                accountId: 'tenant_123'
            });
        }).toThrow();
    });
});

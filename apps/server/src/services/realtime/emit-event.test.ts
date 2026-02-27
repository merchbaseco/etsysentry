import { describe, expect, test } from 'bun:test';
import { onRealtimeEvent, sendRealtimeEvent } from './emit-event';

describe('sendRealtimeEvent', () => {
    test('emits serialized query invalidation events to subscribers', () => {
        const receivedEvents: Array<{ accountId: string; payload: string }> = [];
        const stopListening = onRealtimeEvent((event) => {
            receivedEvents.push(event);
        });

        sendRealtimeEvent({
            type: 'query.invalidate',
            queries: ['app.keywords.list', 'app.listings.list', 'app.shops.list', 'app.logs.list'],
            accountId: 'tenant_123',
        });
        stopListening();

        expect(receivedEvents).toEqual([
            {
                accountId: 'tenant_123',
                payload: JSON.stringify({
                    type: 'query.invalidate',
                    queries: [
                        'app.keywords.list',
                        'app.listings.list',
                        'app.shops.list',
                        'app.logs.list',
                    ],
                }),
            },
        ]);
    });

    test('emits serialized sync state push events to subscribers', () => {
        const receivedEvents: Array<{ accountId: string; payload: string }> = [];
        const stopListening = onRealtimeEvent((event) => {
            receivedEvents.push(event);
        });

        sendRealtimeEvent({
            type: 'sync-state.push',
            entity: 'listing',
            ids: {
                listing_1: 'queued',
            },
            accountId: 'tenant_123',
        });
        stopListening();

        expect(receivedEvents).toEqual([
            {
                accountId: 'tenant_123',
                payload: JSON.stringify({
                    type: 'sync-state.push',
                    entity: 'listing',
                    ids: {
                        listing_1: 'queued',
                    },
                }),
            },
        ]);
    });

    test('rejects invalid realtime events', () => {
        expect(() => {
            sendRealtimeEvent({
                type: 'query.invalidate',
                queries: ['invalid.query'] as unknown as (
                    | 'app.keywords.list'
                    | 'app.listings.list'
                    | 'app.shops.list'
                    | 'app.logs.list'
                )[],
                accountId: 'tenant_123',
            });
        }).toThrow();
    });
});

import { describe, expect, test } from 'bun:test';
import { serializeEventForWire } from './serialize-realtime-event';

describe('serializeEventForWire', () => {
    test('removes accountId from query invalidation events', () => {
        const payload = serializeEventForWire({
            type: 'query.invalidate',
            accountId: 'tenant_123',
            queries: ['app.keywords.list'],
        });

        expect(payload).toBe(
            JSON.stringify({
                type: 'query.invalidate',
                queries: ['app.keywords.list'],
            })
        );
    });

    test('removes accountId from sync state push events', () => {
        const payload = serializeEventForWire({
            type: 'sync-state.push',
            accountId: 'tenant_123',
            entity: 'shop',
            ids: {
                shop_1: 'syncing',
            },
        });

        expect(payload).toBe(
            JSON.stringify({
                type: 'sync-state.push',
                entity: 'shop',
                ids: {
                    shop_1: 'syncing',
                },
            })
        );
    });

    test('removes accountId from dashboard summary push events', () => {
        const payload = serializeEventForWire({
            type: 'dashboard-summary.push',
            accountId: 'tenant_123',
            jobCounts: {
                inFlightJobs: 2,
                queuedJobs: 4,
            },
        });

        expect(payload).toBe(
            JSON.stringify({
                type: 'dashboard-summary.push',
                jobCounts: {
                    inFlightJobs: 2,
                    queuedJobs: 4,
                },
            })
        );
    });
});

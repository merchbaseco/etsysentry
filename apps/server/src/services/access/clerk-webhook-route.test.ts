import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import type { AccessProjectionEvent, AccessProjectionStore } from '@merchbaseco/access';
import Fastify from 'fastify';
import { CLERK_ACCESS_WEBHOOK_PATH, registerClerkAccessWebhookRoute } from './clerk-webhook-route';

const signingKey = 'test-signing-key';
const signingSecret = `whsec_${Buffer.from(signingKey).toString('base64')}`;

describe('Clerk access webhook route', () => {
    test('preserves the raw body and applies a verified projection', async () => {
        const events: AccessProjectionEvent[] = [];
        const app = Fastify();

        await registerClerkAccessWebhookRoute(app, {
            issuer: 'https://clerk.example.com',
            signingSecret,
            store: createStore(events),
        });

        const payload = JSON.stringify({
            data: {
                id: 'user_1',
                public_metadata: {
                    merchbase: {
                        access: 'granted',
                        accessValidUntil: null,
                        userId: 'mbu_1',
                    },
                },
                updated_at: 100,
            },
            type: 'user.updated',
        });

        const response = await app.inject({
            headers: signedHeaders('evt_1', payload),
            method: 'POST',
            payload,
            url: CLERK_ACCESS_WEBHOOK_PATH,
        });

        expect(response.statusCode).toBe(204);
        expect(events).toEqual([
            {
                eventId: 'evt_1',
                projection: {
                    access: 'granted',
                    accessValidUntil: null,
                    issuer: 'https://clerk.example.com',
                    merchbaseUserId: 'mbu_1',
                    sourceUpdatedAt: 100,
                    subject: 'user_1',
                },
                type: 'upsert',
            },
        ]);

        await app.close();
    });

    test('rejects an invalid signature without touching the projection store', async () => {
        const events: AccessProjectionEvent[] = [];
        const app = Fastify();

        await registerClerkAccessWebhookRoute(app, {
            issuer: 'https://clerk.example.com',
            signingSecret,
            store: createStore(events),
        });

        const response = await app.inject({
            headers: {
                'content-type': 'application/json',
                'svix-id': 'evt_invalid',
                'svix-signature': 'v1,invalid',
                'svix-timestamp': String(Math.floor(Date.now() / 1000)),
            },
            method: 'POST',
            payload: '{}',
            url: CLERK_ACCESS_WEBHOOK_PATH,
        });

        expect(response.statusCode).toBe(400);
        expect(events).toHaveLength(0);

        await app.close();
    });
});

const createStore = (events: AccessProjectionEvent[]): AccessProjectionStore => ({
    apply: (event) => {
        events.push(event);
        return Promise.resolve();
    },
    findByIdentity: () => Promise.resolve({ type: 'missing' }),
    findByMerchbaseUserId: () => Promise.resolve(null),
});

const signedHeaders = (eventId: string, payload: string) => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', signingKey)
        .update(`${eventId}.${timestamp}.${payload}`)
        .digest('base64');

    return {
        'content-type': 'application/json',
        'svix-id': eventId,
        'svix-signature': `v1,${signature}`,
        'svix-timestamp': timestamp,
    };
};

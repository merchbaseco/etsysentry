import { describe, expect, test } from 'bun:test';
import {
    type AccessProjection,
    type AccessProjectionEvent,
    type AccessProjectionStore,
    parseAccessSnapshot,
} from '@merchbaseco/access';
import { createEtsySentryApiCloudflareAccess } from './etsysentry-access';

const issuer = 'https://etsysentry.cloudflareaccess.com';
const audience = 'etsysentry-api-audience';
const authorityOrigin = 'https://access-internal.merchbase.co';
const now = Date.UTC(2026, 9, 29, 12);
const merchbaseUserId = 'mbu_cloudflare_api_fixture';

const identityKey = (identity: { issuer: string; subject: string }) =>
    `${identity.issuer}\u0000${identity.subject}`;

const createProjectionFixture = (): AccessProjectionStore => {
    const records = new Map<string, AccessProjection>();

    return {
        apply: (event: AccessProjectionEvent) => {
            if (event.type === 'upsert') {
                records.set(identityKey(event.projection), event.projection);
                return Promise.resolve();
            }
            records.delete(identityKey(event.identity));
            return Promise.resolve();
        },
        findByIdentity: (identity) => {
            const projection = records.get(identityKey(identity));
            return Promise.resolve(
                projection ? { projection, type: 'active' } : { type: 'missing' }
            );
        },
        findByMerchbaseUserId: (userId) =>
            Promise.resolve(
                [...records.values()].find((projection) => projection.merchbaseUserId === userId) ??
                    null
            ),
    };
};

const signAssertion = async (
    keys: CryptoKeyPair,
    claims: Record<string, string | number>
): Promise<string> => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const header = encode({ alg: 'RS256', kid: 'fixture-key', typ: 'JWT' });
    const payload = encode(claims);
    const message = `${header}.${payload}`;
    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        keys.privateKey,
        new TextEncoder().encode(message)
    );
    return `${message}.${Buffer.from(signature).toString('base64url')}`;
};

describe('EtsySentry API Cloudflare assertion lifetimes', () => {
    test('accepts a long person assertion and caps the connection at five minutes', async () => {
        const keys = await crypto.subtle.generateKey(
            {
                name: 'RSASSA-PKCS1-v1_5',
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: 'SHA-256',
            },
            true,
            ['sign', 'verify']
        );
        const issuedAt = Math.floor(now / 1000) - 7;
        const personAssertion = await signAssertion(keys, {
            aud: audience,
            exp: issuedAt + 86_407,
            iat: issuedAt,
            iss: issuer,
            sub: 'cloudflare-person-fixture',
            type: 'app',
        });
        let snapshotLoads = 0;
        const access = createEtsySentryApiCloudflareAccess({
            audience,
            authorityOrigin,
            issuer,
            loadSnapshot: () => {
                snapshotLoads += 1;
                return Promise.resolve(
                    parseAccessSnapshot({
                        access: 'granted',
                        accessValidUntil: now + 86_400_000,
                        eventId: 'person-access-fixture',
                        identities: [
                            {
                                kind: 'person',
                                state: 'active',
                                subject: 'cloudflare-person-fixture',
                            },
                        ],
                        issuer,
                        merchbaseUserId,
                        service: 'etsysentry',
                        sourceUpdatedAt: now,
                    })
                );
            },
            now: () => now,
            projections: createProjectionFixture(),
            resolveKey: async () => keys.publicKey,
            resolveServicePrincipal: async () => ({ accountId: 'acct_cloudflare_fixture' }),
            service: 'etsysentry',
        });

        const authorized = await access.authorize(personAssertion);
        expect(authorized).toMatchObject({
            credentialKind: 'person',
            expiresAt: now + 300_000,
            merchbaseUserId,
            principal: { accountId: 'acct_cloudflare_fixture' },
        });

        const longMachineAssertion = await signAssertion(keys, {
            aud: audience,
            common_name: 'etsysentry-api-machine',
            exp: issuedAt + 601,
            iat: issuedAt,
            iss: issuer,
            sub: '',
            type: 'app',
        });
        await expect(access.authorize(longMachineAssertion)).rejects.toMatchObject({
            code: 'unauthenticated',
        });
        expect(snapshotLoads).toBe(1);
    });
});

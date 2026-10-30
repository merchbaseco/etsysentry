import { afterAll, describe, expect, test } from 'bun:test';
import type { AccessProjectionEvent } from '@merchbaseco/access';
import { DEV_ACCESS_AUTHORITY_ORIGIN } from '@merchbaseco/access/dev';
import { and, eq, sql } from 'drizzle-orm';
import { env } from '../../config/env';
import { db } from '../../db';
import {
    accessProjections,
    accounts,
    etsyApiCallEvents,
    etsyOAuthConnections,
    trackedListings,
} from '../../db/schema';
import { migrateLocalDatabaseToHead } from '../../dev-seed/migrate-to-head';
import { createAccessProjectionStore } from './access-projection-store';

const isDedicatedFixture =
    env.NODE_ENV === 'development' &&
    /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]|::1)$/u.test(env.databaseHost) &&
    /^etsysentry_access_test_[a-z0-9]+$/u.test(env.databaseName);

const authorityIssuer = DEV_ACCESS_AUTHORITY_ORIGIN;
const cloudflareIssuer = 'https://identity.fixture.invalid';
const merchbaseUserId = 'mbu_0ae4691c2dff45559d559bea99cd621b';
const accountId = 'acct_access_adapter_fixture';

describe('AccessProjectionStore PostgreSQL adapter', () => {
    afterAll(async () => {
        if (isDedicatedFixture) {
            const { closeDbConnection } = await import('../../db');
            await closeDbConnection();
        }
    });

    test.skipIf(!isDedicatedFixture)(
        'stores canonical, person, and multiple key aliases without changing business ownership',
        async () => {
            const [target] = await db.execute<{
                databaseName: string;
                accountTable: string | null;
            }>(
                sql`select current_database() as "databaseName", to_regclass('public.accounts')::text as "accountTable"`
            );
            expect(target?.databaseName).toBe(env.databaseName);
            expect(target?.accountTable).toBeNull();

            const databaseUrl = `postgres://${env.databaseHost}:${env.databasePort}/${env.databaseName}`;
            const projections = createAccessProjectionStore(db, authorityIssuer);
            const seededAccess = await migrateLocalDatabaseToHead(db, {
                accountId,
                databaseUrl,
                projections,
            });
            expect(seededAccess.merchbaseUserId).toBe(merchbaseUserId);

            await db.insert(trackedListings).values({
                accountId,
                etsyListingId: 'listing-access-fixture',
                title: 'Access adapter fixture listing',
            });
            await db.insert(etsyOAuthConnections).values({
                accountId,
                accessToken: 'fixture-provider-access-token',
                expiresAt: new Date('2030-01-01T00:00:00.000Z'),
                refreshToken: 'fixture-provider-refresh-token',
                scopes: ['listings_r'],
                tokenType: 'Bearer',
            });
            await db.insert(etsyApiCallEvents).values({
                accountId,
                endpoint: 'fixture/metering',
            });

            const [accountBefore] = await db
                .select({ id: accounts.id, merchbaseUserId: accounts.merchbaseUserId })
                .from(accounts)
                .where(eq(accounts.id, accountId));
            const [listingBefore] = await db
                .select({
                    accountId: trackedListings.accountId,
                    listingId: trackedListings.listingId,
                })
                .from(trackedListings)
                .where(eq(trackedListings.accountId, accountId));
            const [connectionBefore] = await db
                .select({
                    accessToken: etsyOAuthConnections.accessToken,
                    accountId: etsyOAuthConnections.accountId,
                    refreshToken: etsyOAuthConnections.refreshToken,
                })
                .from(etsyOAuthConnections)
                .where(eq(etsyOAuthConnections.accountId, accountId));
            const [meterBefore] = await db
                .select({ accountId: etsyApiCallEvents.accountId, id: etsyApiCallEvents.id })
                .from(etsyApiCallEvents)
                .where(eq(etsyApiCallEvents.accountId, accountId));

            const sourceUpdatedAt = Date.now() + 10_000;
            const firstKeyGrant = {
                eventId: 'fixture-api-key-one',
                projection: {
                    access: 'granted',
                    accessValidUntil: null,
                    issuer: cloudflareIssuer,
                    merchbaseUserId,
                    sourceUpdatedAt,
                    subject: 'api_key:fixture-client-one',
                },
                type: 'upsert' as const,
            } satisfies AccessProjectionEvent;
            const grants: AccessProjectionEvent[] = [
                {
                    eventId: 'fixture-canonical-grant',
                    type: 'upsert',
                    projection: {
                        access: 'granted' as const,
                        accessValidUntil: null,
                        issuer: authorityIssuer,
                        merchbaseUserId,
                        sourceUpdatedAt,
                        subject: merchbaseUserId,
                    },
                },
                {
                    eventId: 'fixture-person-alias',
                    type: 'upsert',
                    projection: {
                        access: 'granted' as const,
                        accessValidUntil: null,
                        issuer: cloudflareIssuer,
                        merchbaseUserId,
                        sourceUpdatedAt,
                        subject: 'person:fixture-user',
                    },
                },
                firstKeyGrant,
                {
                    eventId: 'fixture-api-key-two',
                    type: 'upsert',
                    projection: {
                        access: 'granted' as const,
                        accessValidUntil: null,
                        issuer: cloudflareIssuer,
                        merchbaseUserId,
                        sourceUpdatedAt,
                        subject: 'api_key:fixture-client-two',
                    },
                },
            ];
            for (const event of grants) {
                await projections.apply(event);
            }

            const canonical = await projections.findByMerchbaseUserId(merchbaseUserId);
            expect(canonical).toMatchObject({
                issuer: authorityIssuer,
                subject: merchbaseUserId,
                merchbaseUserId,
                access: 'granted',
            });

            const retiredIdentity = {
                issuer: cloudflareIssuer,
                subject: 'api_key:fixture-client-one',
            };
            await projections.apply({
                eventId: 'fixture-api-key-one-revoked',
                identity: retiredIdentity,
                sourceUpdatedAt: sourceUpdatedAt + 1,
                type: 'remove',
            });
            await projections.apply({
                eventId: 'fixture-api-key-one-late-grant',
                projection: { ...firstKeyGrant.projection, sourceUpdatedAt },
                type: 'upsert',
            });

            const [retiredKey] = await db
                .select({ state: accessProjections.state })
                .from(accessProjections)
                .where(
                    and(
                        eq(accessProjections.issuer, retiredIdentity.issuer),
                        eq(accessProjections.subject, retiredIdentity.subject)
                    )
                );
            const secondKey = await projections.findByIdentity({
                issuer: cloudflareIssuer,
                subject: 'api_key:fixture-client-two',
            });
            expect(retiredKey?.state).toBe('tombstone');
            expect(secondKey).toMatchObject({ type: 'active' });

            const [accountAfter] = await db
                .select({ id: accounts.id, merchbaseUserId: accounts.merchbaseUserId })
                .from(accounts)
                .where(eq(accounts.id, accountId));
            const [listingAfter] = await db
                .select({
                    accountId: trackedListings.accountId,
                    listingId: trackedListings.listingId,
                })
                .from(trackedListings)
                .where(eq(trackedListings.accountId, accountId));
            const [connectionAfter] = await db
                .select({
                    accessToken: etsyOAuthConnections.accessToken,
                    accountId: etsyOAuthConnections.accountId,
                    refreshToken: etsyOAuthConnections.refreshToken,
                })
                .from(etsyOAuthConnections)
                .where(eq(etsyOAuthConnections.accountId, accountId));
            const [meterAfter] = await db
                .select({ accountId: etsyApiCallEvents.accountId, id: etsyApiCallEvents.id })
                .from(etsyApiCallEvents)
                .where(eq(etsyApiCallEvents.accountId, accountId));

            expect(accountAfter).toEqual(accountBefore);
            expect(listingAfter).toEqual(listingBefore);
            expect(connectionAfter).toEqual(connectionBefore);
            expect(meterAfter).toEqual(meterBefore);
        }
    );
});

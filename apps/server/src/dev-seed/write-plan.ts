import { eq, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { db as database } from '../db';
import {
    accounts,
    currencyRates,
    etsyApiCallEvents,
    eventLogs,
    listingMetricSnapshots,
    listingTags,
    productKeywordRanks,
    tags,
    trackedKeywords,
    trackedListings,
    trackedShopListings,
    trackedShopSnapshots,
    trackedShops,
} from '../db/schema';
import type { DevSeedPlan } from './types';

/**
 * Writes a plan into a local database. Idempotent by construction: every
 * account-scoped table is cleared and refilled inside one transaction, so a
 * re-run replaces last run's week instead of stacking a second one on top of
 * it, and a failed run leaves the previous dataset intact.
 */

/** Comfortably inside PostgreSQL's bind-parameter ceiling for wide tables. */
const INSERT_CHUNK_SIZE = 400;

type Database = typeof database;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export const writeDevSeedPlan = async (db: Database, plan: DevSeedPlan): Promise<void> => {
    await db.transaction(async (tx) => {
        await upsertAccount(tx, plan);
        await clearAccountData(tx, plan.accountId);

        const tagIdByPlanId = await upsertTags(tx, plan);

        await insertChunked(tx, trackedListings, plan.trackedListings);
        await insertChunked(
            tx,
            listingTags,
            plan.listingTags.map((row) => ({
                listingId: row.listingId,
                tagId: tagIdByPlanId.get(String(row.tagId)) ?? String(row.tagId),
            }))
        );
        await insertChunked(tx, listingMetricSnapshots, plan.listingSnapshots);
        await insertChunked(tx, trackedKeywords, plan.trackedKeywords);
        await insertChunked(tx, productKeywordRanks, plan.keywordRanks);
        await insertChunked(tx, trackedShops, plan.trackedShops);
        await insertChunked(tx, trackedShopSnapshots, plan.shopSnapshots);
        await insertChunked(tx, trackedShopListings, plan.shopListings);
        await insertChunked(tx, eventLogs, plan.eventLogs);
        await insertChunked(tx, etsyApiCallEvents, plan.apiCallEvents);
        await upsertCurrencyRate(tx, plan);
    });
};

const upsertAccount = async (tx: Transaction, plan: DevSeedPlan): Promise<void> => {
    await tx
        .insert(accounts)
        .values(plan.account)
        .onConflictDoUpdate({
            set: {
                merchbaseUserId: plan.account.merchbaseUserId ?? null,
                updatedAt: plan.account.updatedAt ?? new Date(),
            },
            target: accounts.id,
        });
};

/**
 * Account-scoped tables only, child rows first. `tags` is deliberately absent:
 * the tag vocabulary is global, so deleting it would cascade into another
 * account's listing tags.
 */
const clearAccountData = async (tx: Transaction, accountId: string): Promise<void> => {
    await tx.delete(listingTags).where(
        sql`${listingTags.listingId} in (
            select ${trackedListings.listingId}
            from ${trackedListings}
            where ${trackedListings.accountId} = ${accountId}
        )`
    );
    await tx.delete(productKeywordRanks).where(eq(productKeywordRanks.accountId, accountId));
    await tx.delete(listingMetricSnapshots).where(eq(listingMetricSnapshots.accountId, accountId));
    await tx.delete(trackedShopListings).where(eq(trackedShopListings.accountId, accountId));
    await tx.delete(trackedShopSnapshots).where(eq(trackedShopSnapshots.accountId, accountId));
    await tx.delete(eventLogs).where(eq(eventLogs.accountId, accountId));
    await tx.delete(etsyApiCallEvents).where(eq(etsyApiCallEvents.accountId, accountId));
    await tx.delete(trackedListings).where(eq(trackedListings.accountId, accountId));
    await tx.delete(trackedKeywords).where(eq(trackedKeywords.accountId, accountId));
    await tx.delete(trackedShops).where(eq(trackedShops.accountId, accountId));
};

/**
 * Tags are shared across accounts and unique on the normalized text, so the
 * seed adopts whatever id already exists rather than forcing its own. The
 * returned map rewrites the plan's listing-tag edges onto the real ids.
 */
const upsertTags = async (tx: Transaction, plan: DevSeedPlan): Promise<Map<string, string>> => {
    if (plan.tags.length === 0) {
        return new Map();
    }

    const stored = await tx
        .insert(tags)
        .values(plan.tags)
        .onConflictDoUpdate({
            set: { normalizedTag: sql`excluded.normalized_tag` },
            target: tags.normalizedTag,
        })
        .returning({ id: tags.id, normalizedTag: tags.normalizedTag });

    const idByTag = new Map(stored.map((row) => [row.normalizedTag, row.id]));

    return new Map(
        plan.tags.flatMap((row) => {
            const storedId = idByTag.get(row.normalizedTag);
            return storedId ? [[String(row.id), storedId] as const] : [];
        })
    );
};

const upsertCurrencyRate = async (tx: Transaction, plan: DevSeedPlan): Promise<void> => {
    await tx
        .insert(currencyRates)
        .values(plan.currencyRate)
        .onConflictDoUpdate({
            set: {
                fetchedAt: plan.currencyRate.fetchedAt ?? null,
                lastRefreshError: null,
                nextRefreshAt: plan.currencyRate.nextRefreshAt ?? null,
                provider: plan.currencyRate.provider,
                ratesJson: plan.currencyRate.ratesJson ?? null,
                updatedAt: plan.currencyRate.updatedAt ?? new Date(),
            },
            target: currencyRates.baseCurrency,
        });
};

/**
 * PostgreSQL binds one parameter per column per row, so a wide table with a
 * long window would overflow the statement limit in a single insert.
 */
const insertChunked = async <TTable extends PgTable>(
    tx: Transaction,
    table: TTable,
    rows: readonly TTable['$inferInsert'][]
): Promise<void> => {
    for (let start = 0; start < rows.length; start += INSERT_CHUNK_SIZE) {
        await tx.insert(table).values(rows.slice(start, start + INSERT_CHUNK_SIZE));
    }
};

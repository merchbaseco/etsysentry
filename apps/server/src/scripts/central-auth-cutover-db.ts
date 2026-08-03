import type { Sql } from 'postgres';
import {
    assertCutoverAuditMatchesMapping,
    buildCutoverPlan,
    type CutoverAudit,
    type CutoverMapping,
    type CutoverPlan,
    fingerprint,
    mappingFingerprint,
    type ProductRowCounts,
} from './central-auth-cutover-lib';
import { seedCutoverProjections } from './central-auth-cutover-projections';

interface CountRow {
    value: number | string;
}

interface IdentityRow {
    issuer: string;
    subject: string;
}

const readCount = async (query: Promise<CountRow[]>): Promise<number> => {
    const [row] = await query;
    const value = Number(row?.value ?? 0);

    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error('Cutover audit returned an invalid row count.');
    }

    return value;
};

const readProductRowCounts = async (
    database: Sql,
    accountId: string
): Promise<ProductRowCounts> => {
    const [
        currencyRates,
        etsyApiCallEvents,
        etsyOAuthConnections,
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
    ] = await Promise.all([
        readCount(database`SELECT count(*)::int AS value FROM currency_rates`),
        readCount(
            database`SELECT count(*)::int AS value FROM etsy_api_call_events WHERE account_id = ${accountId}`
        ),
        readCount(
            database`SELECT count(*)::int AS value FROM etsy_oauth_connections WHERE account_id = ${accountId}`
        ),
        readCount(
            database`SELECT count(*)::int AS value FROM event_logs WHERE account_id = ${accountId}`
        ),
        readCount(
            database`SELECT count(*)::int AS value FROM listing_metric_snapshots WHERE account_id = ${accountId}`
        ),
        readCount(database`
            SELECT count(*)::int AS value
            FROM listing_tags
            INNER JOIN tracked_listings ON tracked_listings.listing_id = listing_tags.listing_id
            WHERE tracked_listings.account_id = ${accountId}
        `),
        readCount(
            database`SELECT count(*)::int AS value FROM product_keyword_ranks WHERE account_id = ${accountId}`
        ),
        readCount(database`SELECT count(*)::int AS value FROM tags`),
        readCount(
            database`SELECT count(*)::int AS value FROM tracked_keywords WHERE account_id = ${accountId}`
        ),
        readCount(
            database`SELECT count(*)::int AS value FROM tracked_listings WHERE account_id = ${accountId}`
        ),
        readCount(
            database`SELECT count(*)::int AS value FROM tracked_shop_listings WHERE account_id = ${accountId}`
        ),
        readCount(
            database`SELECT count(*)::int AS value FROM tracked_shop_snapshots WHERE account_id = ${accountId}`
        ),
        readCount(
            database`SELECT count(*)::int AS value FROM tracked_shops WHERE account_id = ${accountId}`
        ),
    ]);

    return {
        currencyRates,
        etsyApiCallEvents,
        etsyOAuthConnections,
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
    };
};

export const loadCutoverAudit = async (
    database: Sql,
    mapping?: CutoverMapping
): Promise<CutoverAudit> => {
    const [
        accountCount,
        activeLegacyApiKeyCount,
        clerkIdentityCount,
        duplicateNormalizedEmailGroupCount,
        etsyOAuthConnectionCount,
    ] = await Promise.all([
        readCount(database`SELECT count(*)::int AS value FROM accounts`),
        readCount(database`SELECT count(*)::int AS value FROM api_keys WHERE revoked_at IS NULL`),
        readCount(database`SELECT count(*)::int AS value FROM clerk_identities`),
        readCount(database`
            SELECT count(*)::int AS value
            FROM (
                SELECT lower(trim(email))
                FROM clerk_identities
                WHERE email IS NOT NULL
                GROUP BY lower(trim(email))
                HAVING count(*) > 1
            ) AS duplicate_groups
        `),
        readCount(database`SELECT count(*)::int AS value FROM etsy_oauth_connections`),
    ]);

    if (!mapping) {
        return {
            global: {
                accountCount,
                activeLegacyApiKeyCount,
                clerkIdentityCount,
                duplicateNormalizedEmailGroupCount,
                etsyOAuthConnectionCount,
            },
            target: null,
        };
    }

    const [
        accountRowCount,
        targetActiveLegacyApiKeyCount,
        targetEtsyOAuthConnectionCount,
        identityRows,
        productRowCounts,
    ] = await Promise.all([
        readCount(
            database`SELECT count(*)::int AS value FROM accounts WHERE id = ${mapping.accountId}`
        ),
        readCount(
            database`SELECT count(*)::int AS value FROM api_keys WHERE account_id = ${mapping.accountId} AND revoked_at IS NULL`
        ),
        readCount(
            database`SELECT count(*)::int AS value FROM etsy_oauth_connections WHERE account_id = ${mapping.accountId}`
        ),
        database<IdentityRow[]>`
            SELECT clerk_issuer AS issuer, clerk_subject AS subject
            FROM clerk_identities
            WHERE account_id = ${mapping.accountId}
            ORDER BY clerk_issuer, clerk_subject
        `,
        readProductRowCounts(database, mapping.accountId),
    ]);

    return {
        global: {
            accountCount,
            activeLegacyApiKeyCount,
            clerkIdentityCount,
            duplicateNormalizedEmailGroupCount,
            etsyOAuthConnectionCount,
        },
        target: {
            accountRowCount,
            activeLegacyApiKeyCount: targetActiveLegacyApiKeyCount,
            etsyOAuthConnectionCount: targetEtsyOAuthConnectionCount,
            identityCount: identityRows.length,
            identitySetFingerprint: fingerprint(
                identityRows.map((row) => `${row.issuer}:${row.subject}`).join('\n')
            ),
            productRowCounts,
        },
    };
};

export const backfillCutover = async (params: {
    database: Sql;
    mapping: CutoverMapping;
    plan: CutoverPlan;
}): Promise<void> => {
    if (params.plan.mappingFingerprint !== mappingFingerprint(params.mapping)) {
        throw new Error('Mapping does not match the supplied cutover plan.');
    }

    await params.database.begin(async (transaction) => {
        const database = transaction as unknown as Sql;
        await database`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;

        const before = await loadCutoverAudit(database, params.mapping);
        assertCutoverAuditMatchesMapping({ audit: before, mapping: params.mapping });
        const currentPlan = buildCutoverPlan({ audit: before, mapping: params.mapping });

        if (currentPlan.planDigest !== params.plan.planDigest) {
            throw new Error('Cutover facts changed since planning; do not continue.');
        }

        const updatedAccounts = await database`
            UPDATE accounts
            SET merchbase_user_id = ${params.mapping.merchbaseUserId}, updated_at = now()
            WHERE id = ${params.mapping.accountId}
              AND (
                  merchbase_user_id IS NULL
                  OR merchbase_user_id = ${params.mapping.merchbaseUserId}
              )
            RETURNING id
        `;

        if (!updatedAccounts[0]) {
            throw new Error('Local account mapping changed or could not be written.');
        }

        await seedCutoverProjections(database, params.mapping);

        const after = await loadCutoverAudit(database, params.mapping);
        assertCutoverAuditMatchesMapping({ audit: after, mapping: params.mapping });

        if (
            JSON.stringify(before.target?.productRowCounts) !==
            JSON.stringify(after.target?.productRowCounts)
        ) {
            throw new Error('Product row counts changed during access backfill.');
        }

        if (JSON.stringify(before.global) !== JSON.stringify(after.global)) {
            throw new Error('Global row counts changed during access backfill.');
        }
    });
};

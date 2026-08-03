import type { Sql } from 'postgres';
import type { LegacyOwnershipAudit } from './central-auth-cutover-lib';

interface CountRow {
    value: number | string;
}

const readCount = async (query: Promise<CountRow[]>): Promise<number> => {
    const [row] = await query;
    const value = Number(row?.value ?? 0);

    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error('Legacy ownership audit returned an invalid row count.');
    }

    return value;
};

export const readLegacyOwnershipAudit = async (
    database: Sql,
    accountId: string
): Promise<LegacyOwnershipAudit> => {
    const [
        etsyApiCallEventCount,
        orphanAccountCount,
        systemEtsyApiCallEventCount,
        trackedKeywordCount,
        trackedListingCount,
        unmatchedIdentityCount,
    ] = await Promise.all([
        readCount(
            database`SELECT count(*)::int AS value FROM etsy_api_call_events WHERE account_id = ${accountId}`
        ),
        readCount(database`
            SELECT count(*)::int AS value
            FROM (
                SELECT account_id FROM tracked_keywords
                UNION ALL
                SELECT account_id FROM tracked_listings
                UNION ALL
                SELECT account_id FROM etsy_api_call_events
            ) AS ownership_reference
            WHERE NOT EXISTS (
                SELECT 1 FROM accounts WHERE accounts.id = ownership_reference.account_id
            )
        `),
        readCount(database`
            SELECT count(*)::int AS value
            FROM etsy_api_call_events
            WHERE account_id = ${accountId} AND clerk_user_id = 'system'
        `),
        readCount(
            database`SELECT count(*)::int AS value FROM tracked_keywords WHERE account_id = ${accountId}`
        ),
        readCount(
            database`SELECT count(*)::int AS value FROM tracked_listings WHERE account_id = ${accountId}`
        ),
        readCount(database`
            SELECT count(*)::int AS value
            FROM (
                SELECT account_id, tracker_clerk_user_id AS subject
                FROM tracked_keywords
                UNION ALL
                SELECT account_id, tracker_clerk_user_id AS subject
                FROM tracked_listings
                UNION ALL
                SELECT account_id, clerk_user_id AS subject
                FROM etsy_api_call_events
                WHERE clerk_user_id <> 'system'
            ) AS legacy_reference
            WHERE legacy_reference.account_id = ${accountId}
              AND NOT EXISTS (
                  SELECT 1
                  FROM clerk_identities AS legacy_identity
                  WHERE legacy_identity.account_id = legacy_reference.account_id
                    AND legacy_identity.clerk_subject = legacy_reference.subject
              )
        `),
    ]);

    return {
        etsyApiCallEventCount,
        orphanAccountCount,
        systemEtsyApiCallEventCount,
        trackedKeywordCount,
        trackedListingCount,
        unmatchedIdentityCount,
    };
};

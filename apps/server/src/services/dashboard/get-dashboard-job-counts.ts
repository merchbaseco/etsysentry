import { eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { trackedKeywords, trackedListings, trackedShops } from '../../db/schema';
import { sumSyncJobCounts } from './get-dashboard-summary';

interface SyncJobCounts {
    inFlightJobs: number;
    queuedJobs: number;
}

const countTrackedListingSyncJobs = async (params: {
    accountId: string;
}): Promise<SyncJobCounts> => {
    const [row] = await db
        .select({
            inFlightJobs: sql<number>`
                count(*) filter (where ${trackedListings.syncState} = 'syncing')::int
            `,
            queuedJobs: sql<number>`
                count(*) filter (where ${trackedListings.syncState} = 'queued')::int
            `,
        })
        .from(trackedListings)
        .where(eq(trackedListings.accountId, params.accountId));

    return {
        inFlightJobs: row?.inFlightJobs ?? 0,
        queuedJobs: row?.queuedJobs ?? 0,
    };
};

const countTrackedKeywordSyncJobs = async (params: {
    accountId: string;
}): Promise<SyncJobCounts> => {
    const [row] = await db
        .select({
            inFlightJobs: sql<number>`
                count(*) filter (where ${trackedKeywords.syncState} = 'syncing')::int
            `,
            queuedJobs: sql<number>`
                count(*) filter (where ${trackedKeywords.syncState} = 'queued')::int
            `,
        })
        .from(trackedKeywords)
        .where(eq(trackedKeywords.accountId, params.accountId));

    return {
        inFlightJobs: row?.inFlightJobs ?? 0,
        queuedJobs: row?.queuedJobs ?? 0,
    };
};

const countTrackedShopSyncJobs = async (params: { accountId: string }): Promise<SyncJobCounts> => {
    const [row] = await db
        .select({
            inFlightJobs: sql<number>`
                count(*) filter (where ${trackedShops.syncState} = 'syncing')::int
            `,
            queuedJobs: sql<number>`
                count(*) filter (where ${trackedShops.syncState} = 'queued')::int
            `,
        })
        .from(trackedShops)
        .where(eq(trackedShops.accountId, params.accountId));

    return {
        inFlightJobs: row?.inFlightJobs ?? 0,
        queuedJobs: row?.queuedJobs ?? 0,
    };
};

export const sumDashboardJobCounts = (counts: SyncJobCounts[]): SyncJobCounts => {
    return sumSyncJobCounts(counts);
};

export const getDashboardJobCounts = async (params: {
    accountId: string;
}): Promise<SyncJobCounts> => {
    const [listingCounts, keywordCounts, shopCounts] = await Promise.all([
        countTrackedListingSyncJobs({
            accountId: params.accountId,
        }),
        countTrackedKeywordSyncJobs({
            accountId: params.accountId,
        }),
        countTrackedShopSyncJobs({
            accountId: params.accountId,
        }),
    ]);

    return sumDashboardJobCounts([listingCounts, keywordCounts, shopCounts]);
};

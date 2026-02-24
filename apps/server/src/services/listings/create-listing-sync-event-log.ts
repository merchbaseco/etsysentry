import { createEventLog } from '../logs/create-event-log';

type ListingSyncedEventLogParams = {
    accountId: string;
    clerkUserId: string;
    etsyListingId: string;
    etsyState: string;
    listingId: string;
    monitorRunId?: string | null;
    requestId?: string | null;
    shopId: string | null;
    title: string;
};

type ListingSyncFailedEventLogParams = {
    accountId: string;
    clerkUserId: string;
    errorMessage: string;
    etsyListingId: string;
    listingId?: string | null;
    monitorRunId?: string | null;
    requestId?: string | null;
    shopId?: string | null;
};

export const buildListingSyncedEventLogInput = (params: ListingSyncedEventLogParams) => {
    return {
        action: 'listing.synced',
        category: 'listing',
        clerkUserId: params.clerkUserId,
        detailsJson: {
            etsyState: params.etsyState,
            title: params.title
        },
        level: 'info' as const,
        listingId: params.etsyListingId,
        message: `Synced listing ${params.etsyListingId}.`,
        monitorRunId: params.monitorRunId ?? null,
        primitiveId: params.listingId,
        primitiveType: 'listing' as const,
        requestId: params.requestId ?? null,
        shopId: params.shopId,
        status: 'success' as const,
        accountId: params.accountId
    };
};

export const buildListingSyncFailedEventLogInput = (params: ListingSyncFailedEventLogParams) => {
    return {
        action: 'listing.sync_failed',
        category: 'listing',
        clerkUserId: params.clerkUserId,
        detailsJson: {
            error: params.errorMessage
        },
        level: 'error' as const,
        listingId: params.etsyListingId,
        message: `Listing sync failed for ${params.etsyListingId}: ${params.errorMessage}`,
        monitorRunId: params.monitorRunId ?? null,
        primitiveId: params.listingId ?? null,
        primitiveType: 'listing' as const,
        requestId: params.requestId ?? null,
        shopId: params.shopId ?? null,
        status: 'failed' as const,
        accountId: params.accountId
    };
};

export const createListingSyncedEventLog = async (
    params: ListingSyncedEventLogParams
): Promise<void> => {
    await createEventLog(buildListingSyncedEventLogInput(params));
};

export const createListingSyncFailedEventLog = async (
    params: ListingSyncFailedEventLogParams
): Promise<void> => {
    await createEventLog(buildListingSyncFailedEventLogInput(params));
};

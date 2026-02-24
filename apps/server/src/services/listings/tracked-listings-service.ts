import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { trackedListings } from '../../db/schema';
import { createEventLog } from '../logs/create-event-log';
import {
    EtsyGetListingBridgeError,
    getListing,
    type GetListingBridgeResponse
} from '../etsy/bridges/get-listing';
import { getEtsyOAuthAccessToken } from '../etsy/oauth-service';
import { recordEtsyApiCallBestEffort } from '../etsy/record-etsy-api-call';
import {
    buildDigitalListingTrackingErrorMessage,
    isExcludedDigitalListingType
} from './is-excluded-digital-listing-type';
import {
    isTrackedListingSyncInFlight,
    setTrackedListingSyncStateByListingId
} from './set-tracked-listing-sync-state';
import {
    createListingSyncFailedEventLog,
    createListingSyncedEventLog
} from './create-listing-sync-event-log';
import { setTrackedShopListingActivityByEtsyListingId } from '../shops/set-tracked-shop-listing-activity';
import { upsertListingMetricSnapshot } from './upsert-listing-metric-snapshot';

export type TrackedListingRecord = {
    etsyListingId: string;
    etsyState: (typeof trackedListings.$inferSelect)['etsyState'];
    id: string;
    isDigital: boolean;
    lastRefreshError: string | null;
    lastRefreshedAt: string;
    price: {
        amount: number;
        currencyCode: string;
        divisor: number;
        value: number;
    } | null;
    quantity: number | null;
    shopId: string | null;
    shopName: string | null;
    accountId: string;
    thumbnailUrl: string | null;
    title: string;
    trackerClerkUserId: string;
    syncState: (typeof trackedListings.$inferSelect)['syncState'];
    trackingState: (typeof trackedListings.$inferSelect)['trackingState'];
    updatedAt: string;
    updatedTimestamp: number | null;
    url: string | null;
    views: number | null;
    numFavorers: number | null;
};

const mapBridgeErrorToTrpcError = (error: EtsyGetListingBridgeError): TRPCError => {
    if (error.statusCode === 404) {
        return new TRPCError({
            code: 'NOT_FOUND',
            message: 'Etsy listing was not found.'
        });
    }

    if (error.statusCode === 400) {
        return new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message
        });
    }

    if (error.statusCode === 401 || error.statusCode === 403) {
        const genericStatusMessage = `Etsy getListing failed with HTTP ${error.statusCode}.`;

        return new TRPCError({
            code: 'FORBIDDEN',
            message:
                error.message === genericStatusMessage
                    ? 'Etsy access token is invalid or missing required scope.'
                    : error.message
        });
    }

    return new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message
    });
};

const parseListingIdentifier = (rawInput: string): string | null => {
    const trimmed = rawInput.trim();

    if (/^\d+$/.test(trimmed)) {
        return trimmed;
    }

    try {
        const url = new URL(trimmed);

        if (!url.hostname.toLowerCase().includes('etsy.com')) {
            return null;
        }

        const match = url.pathname.match(/\/listing\/(\d+)(?:\/|$)/i);

        if (match?.[1]) {
            return match[1];
        }

        const listingIdFromQuery = url.searchParams.get('listing_id');

        if (listingIdFromQuery && /^\d+$/.test(listingIdFromQuery)) {
            return listingIdFromQuery;
        }

        return null;
    } catch {
        return null;
    }
};

const toRecord = (row: typeof trackedListings.$inferSelect): TrackedListingRecord => {
    let price: TrackedListingRecord['price'] = null;

    if (
        row.priceAmount !== null &&
        row.priceDivisor !== null &&
        row.priceCurrencyCode !== null &&
        row.priceDivisor > 0
    ) {
        price = {
            amount: row.priceAmount,
            currencyCode: row.priceCurrencyCode,
            divisor: row.priceDivisor,
            value: row.priceAmount / row.priceDivisor
        };
    }

    return {
        etsyListingId: row.etsyListingId,
        etsyState: row.etsyState,
        id: row.listingId,
        isDigital: row.isDigital,
        lastRefreshError: row.lastRefreshError,
        lastRefreshedAt: row.lastRefreshedAt.toISOString(),
        numFavorers: row.numFavorers,
        price,
        quantity: row.quantity,
        shopId: row.shopId,
        shopName: row.shopName,
        accountId: row.accountId,
        thumbnailUrl: row.thumbnailUrl ?? null,
        title: row.title,
        trackerClerkUserId: row.trackerClerkUserId,
        syncState: row.syncState,
        trackingState: row.trackingState,
        updatedAt: row.updatedAt.toISOString(),
        updatedTimestamp: row.updatedTimestamp,
        url: row.url,
        views: row.views
    };
};

const bridgeToUpsertValues = (params: {
    bridgeResponse: GetListingBridgeResponse;
    now: Date;
    accountId: string;
    trackerClerkUserId: string;
}) => {
    return {
        etsyListingId: params.bridgeResponse.listingId,
        etsyState: params.bridgeResponse.etsyState,
        isDigital: isExcludedDigitalListingType(params.bridgeResponse.listingType),
        lastRefreshError: null,
        lastRefreshedAt: params.now,
        numFavorers: params.bridgeResponse.numFavorers,
        priceAmount: params.bridgeResponse.price?.amount ?? null,
        priceCurrencyCode: params.bridgeResponse.price?.currencyCode ?? null,
        priceDivisor: params.bridgeResponse.price?.divisor ?? null,
        quantity: params.bridgeResponse.quantity,
        shopId: params.bridgeResponse.shopId,
        shopName: params.bridgeResponse.shopName,
        accountId: params.accountId,
        thumbnailUrl: params.bridgeResponse.thumbnailUrl,
        title: params.bridgeResponse.title,
        trackerClerkUserId: params.trackerClerkUserId,
        syncState: 'idle' as const,
        trackingState: isExcludedDigitalListingType(params.bridgeResponse.listingType)
            ? ('paused' as const)
            : ('active' as const),
        updatedAt: params.now,
        updatedTimestamp: params.bridgeResponse.updatedTimestamp,
        url: params.bridgeResponse.url,
        views: params.bridgeResponse.views
    };
};

const fetchListingFromEtsy = async (params: {
    clerkUserId: string;
    etsyListingId: string;
    accountId: string;
}): Promise<GetListingBridgeResponse> => {
    const oauthToken = await getEtsyOAuthAccessToken({
        accountId: params.accountId
    });

    try {
        await recordEtsyApiCallBestEffort({
            clerkUserId: params.clerkUserId,
            endpoint: 'getListing',
            accountId: params.accountId
        });

        return await getListing({
            accessToken: oauthToken.accessToken,
            includes: ['Images'],
            listingId: params.etsyListingId
        });
    } catch (error) {
        if (error instanceof EtsyGetListingBridgeError) {
            throw mapBridgeErrorToTrpcError(error);
        }

        throw error;
    }
};

const upsertTrackedListingFromBridgeResponse = async (params: {
    bridgeResponse: GetListingBridgeResponse;
    now: Date;
    accountId: string;
    trackerClerkUserId: string;
}): Promise<typeof trackedListings.$inferSelect> => {
    const upsertValues = bridgeToUpsertValues({
        bridgeResponse: params.bridgeResponse,
        now: params.now,
        accountId: params.accountId,
        trackerClerkUserId: params.trackerClerkUserId
    });

    const [row] = await db
        .insert(trackedListings)
        .values(upsertValues)
        .onConflictDoUpdate({
            set: upsertValues,
            target: [trackedListings.accountId, trackedListings.etsyListingId]
        })
        .returning();

    if (!row) {
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Unable to upsert tracked listing.'
        });
    }

    return row;
};

export const syncTrackedListingFromEtsy = async (params: {
    clerkUserId: string;
    etsyListingId: string;
    accountId: string;
    trackerClerkUserId: string;
    rejectExcludedListingType?: boolean;
}): Promise<typeof trackedListings.$inferSelect> => {
    const now = new Date();
    const listingFromEtsy = await fetchListingFromEtsy({
        clerkUserId: params.clerkUserId,
        etsyListingId: params.etsyListingId,
        accountId: params.accountId
    });

    if (
        params.rejectExcludedListingType &&
        isExcludedDigitalListingType(listingFromEtsy.listingType)
    ) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: buildDigitalListingTrackingErrorMessage()
        });
    }

    const row = await upsertTrackedListingFromBridgeResponse({
        bridgeResponse: listingFromEtsy,
        now,
        accountId: params.accountId,
        trackerClerkUserId: params.trackerClerkUserId
    });

    await upsertListingMetricSnapshot({
        accountId: row.accountId,
        listingId: row.listingId,
        observedAt: now,
        views: row.views,
        favorerCount: row.numFavorers,
        quantity: row.quantity,
        priceAmount: row.priceAmount,
        priceDivisor: row.priceDivisor,
        priceCurrencyCode: row.priceCurrencyCode
    });

    await setTrackedShopListingActivityByEtsyListingId({
        accountId: params.accountId,
        etsyListingId: row.etsyListingId,
        isActive: row.etsyState === 'active'
    });

    return row;
};

export const listTrackedListings = async (params: {
    accountId: string;
    trackerClerkUserId?: string;
}): Promise<{ items: TrackedListingRecord[] }> => {
    const whereClause = params.trackerClerkUserId
        ? and(
              eq(trackedListings.accountId, params.accountId),
              eq(trackedListings.trackerClerkUserId, params.trackerClerkUserId)
          )
        : eq(trackedListings.accountId, params.accountId);

    const rows = await db
        .select()
        .from(trackedListings)
        .where(whereClause)
        .orderBy(desc(trackedListings.updatedAt));

    return {
        items: rows.map(toRecord)
    };
};

export const trackListing = async (params: {
    listingInput: string;
    requestId?: string;
    accountId: string;
    trackerClerkUserId: string;
}): Promise<{
    created: boolean;
    item: TrackedListingRecord;
}> => {
    const etsyListingId = parseListingIdentifier(params.listingInput);

    if (!etsyListingId) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Listing must be an Etsy listing URL or numeric listing id.'
        });
    }

    const existing = await db
        .select({
            listingId: trackedListings.listingId
        })
        .from(trackedListings)
        .where(
            and(
                eq(trackedListings.accountId, params.accountId),
                eq(trackedListings.etsyListingId, etsyListingId)
            )
        )
        .limit(1);

    const row = await syncTrackedListingFromEtsy({
        clerkUserId: params.trackerClerkUserId,
        etsyListingId,
        accountId: params.accountId,
        trackerClerkUserId: params.trackerClerkUserId,
        rejectExcludedListingType: true
    });

    const created = existing.length === 0;
    const item = toRecord(row);

    await createEventLog({
        action: created ? 'listing.tracked' : 'listing.updated',
        category: 'listing',
        clerkUserId: params.trackerClerkUserId,
        detailsJson: {
            title: item.title
        },
        level: 'info',
        listingId: item.etsyListingId,
        message: created
            ? `Started tracking listing ${item.etsyListingId}.`
            : `Updated tracked listing ${item.etsyListingId}.`,
        primitiveId: item.id,
        primitiveType: 'listing',
        requestId: params.requestId ?? null,
        shopId: item.shopId,
        status: 'success',
        accountId: item.accountId
    });

    return {
        created,
        item
    };
};

export const refreshTrackedListing = async (params: {
    clerkUserId: string;
    requestId?: string;
    accountId: string;
    trackedListingId: string;
    trackerClerkUserId: string;
}): Promise<TrackedListingRecord> => {
    const [current] = await db
        .select()
        .from(trackedListings)
        .where(
            and(
                eq(trackedListings.listingId, params.trackedListingId),
                eq(trackedListings.accountId, params.accountId)
            )
        )
        .limit(1);

    if (!current) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Tracked listing was not found for this account.'
        });
    }

    if (isTrackedListingSyncInFlight(current.syncState)) {
        throw new TRPCError({
            code: 'CONFLICT',
            message: 'Tracked listing sync is already queued or in progress.'
        });
    }

    const didSetSyncing = await setTrackedListingSyncStateByListingId({
        accountId: params.accountId,
        syncState: 'syncing',
        trackedListingId: current.listingId
    });

    if (!didSetSyncing) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Tracked listing was not found for this account.'
        });
    }

    try {
        const updated = await syncTrackedListingFromEtsy({
            clerkUserId: params.clerkUserId,
            etsyListingId: current.etsyListingId,
            accountId: params.accountId,
            trackerClerkUserId: params.trackerClerkUserId
        });

        await setTrackedListingSyncStateByListingId({
            accountId: params.accountId,
            syncState: 'idle',
            trackedListingId: current.listingId
        });

        await createListingSyncedEventLog({
            accountId: updated.accountId,
            clerkUserId: params.clerkUserId,
            etsyListingId: updated.etsyListingId,
            etsyState: updated.etsyState,
            listingId: updated.listingId,
            requestId: params.requestId ?? null,
            shopId: updated.shopId,
            title: updated.title
        });

        return toRecord(updated);
    } catch (error) {
        const failureMessage =
            error instanceof TRPCError ? error.message : 'Unexpected listing refresh error.';

        const [updated] = await db
            .update(trackedListings)
            .set({
                lastRefreshError: failureMessage,
                lastRefreshedAt: new Date(),
                syncState: 'idle',
                trackingState: 'error',
                updatedAt: new Date()
            })
            .where(eq(trackedListings.listingId, current.listingId))
            .returning();

        if (!updated) {
            throw error;
        }

        await setTrackedListingSyncStateByListingId({
            accountId: params.accountId,
            syncState: 'idle',
            trackedListingId: current.listingId
        });

        try {
            await createListingSyncFailedEventLog({
                accountId: updated.accountId,
                clerkUserId: params.clerkUserId,
                errorMessage: failureMessage,
                etsyListingId: updated.etsyListingId,
                listingId: updated.listingId,
                requestId: params.requestId ?? null,
                shopId: updated.shopId
            });
        } catch {
            // Preserve the original sync failure.
        }

        throw error;
    }
};

import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { trackedListings } from '../../db/schema';
import {
    EtsyGetListingBridgeError,
    getListing,
    type GetListingBridgeResponse
} from '../etsy/bridges/get-listing';
import { getEtsyOAuthAccessToken } from '../etsy/oauth-service';

export type TrackedListingRecord = {
    etsyListingId: string;
    etsyState: (typeof trackedListings.$inferSelect)['etsyState'];
    id: string;
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
    tenantId: string;
    thumbnailUrl: string | null;
    title: string;
    trackerClerkUserId: string;
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
        lastRefreshError: row.lastRefreshError,
        lastRefreshedAt: row.lastRefreshedAt.toISOString(),
        numFavorers: row.numFavorers,
        price,
        quantity: row.quantity,
        shopId: row.shopId,
        shopName: row.shopName,
        tenantId: row.tenantId,
        thumbnailUrl: row.thumbnailUrl ?? null,
        title: row.title,
        trackerClerkUserId: row.trackerClerkUserId,
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
    tenantId: string;
    trackerClerkUserId: string;
}) => {
    return {
        etsyListingId: params.bridgeResponse.listingId,
        etsyState: params.bridgeResponse.etsyState,
        lastRefreshError: null,
        lastRefreshedAt: params.now,
        numFavorers: params.bridgeResponse.numFavorers,
        priceAmount: params.bridgeResponse.price?.amount ?? null,
        priceCurrencyCode: params.bridgeResponse.price?.currencyCode ?? null,
        priceDivisor: params.bridgeResponse.price?.divisor ?? null,
        quantity: params.bridgeResponse.quantity,
        shopId: params.bridgeResponse.shopId,
        shopName: params.bridgeResponse.shopName,
        tenantId: params.tenantId,
        thumbnailUrl: params.bridgeResponse.thumbnailUrl,
        title: params.bridgeResponse.title,
        trackerClerkUserId: params.trackerClerkUserId,
        trackingState: 'active' as const,
        updatedAt: params.now,
        updatedTimestamp: params.bridgeResponse.updatedTimestamp,
        url: params.bridgeResponse.url,
        views: params.bridgeResponse.views
    };
};

const fetchListingFromEtsy = async (params: {
    clerkUserId: string;
    etsyListingId: string;
    tenantId: string;
}): Promise<GetListingBridgeResponse> => {
    const oauthToken = await getEtsyOAuthAccessToken({
        clerkUserId: params.clerkUserId,
        tenantId: params.tenantId
    });

    try {
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
    tenantId: string;
    trackerClerkUserId: string;
}): Promise<typeof trackedListings.$inferSelect> => {
    const upsertValues = bridgeToUpsertValues({
        bridgeResponse: params.bridgeResponse,
        now: params.now,
        tenantId: params.tenantId,
        trackerClerkUserId: params.trackerClerkUserId
    });

    const [row] = await db
        .insert(trackedListings)
        .values(upsertValues)
        .onConflictDoUpdate({
            set: upsertValues,
            target: [trackedListings.tenantId, trackedListings.etsyListingId]
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
    tenantId: string;
    trackerClerkUserId: string;
}): Promise<typeof trackedListings.$inferSelect> => {
    const listingFromEtsy = await fetchListingFromEtsy({
        clerkUserId: params.clerkUserId,
        etsyListingId: params.etsyListingId,
        tenantId: params.tenantId
    });

    return upsertTrackedListingFromBridgeResponse({
        bridgeResponse: listingFromEtsy,
        now: new Date(),
        tenantId: params.tenantId,
        trackerClerkUserId: params.trackerClerkUserId
    });
};

export const listTrackedListings = async (params: {
    tenantId: string;
    trackerClerkUserId?: string;
}): Promise<{ items: TrackedListingRecord[] }> => {
    const whereClause = params.trackerClerkUserId
        ? and(
              eq(trackedListings.tenantId, params.tenantId),
              eq(trackedListings.trackerClerkUserId, params.trackerClerkUserId)
          )
        : eq(trackedListings.tenantId, params.tenantId);

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
    tenantId: string;
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
                eq(trackedListings.tenantId, params.tenantId),
                eq(trackedListings.etsyListingId, etsyListingId)
            )
        )
        .limit(1);

    const row = await syncTrackedListingFromEtsy({
        clerkUserId: params.trackerClerkUserId,
        etsyListingId,
        tenantId: params.tenantId,
        trackerClerkUserId: params.trackerClerkUserId
    });

    return {
        created: existing.length === 0,
        item: toRecord(row)
    };
};

export const refreshTrackedListing = async (params: {
    clerkUserId: string;
    tenantId: string;
    trackedListingId: string;
    trackerClerkUserId: string;
}): Promise<TrackedListingRecord> => {
    const [current] = await db
        .select()
        .from(trackedListings)
        .where(
            and(
                eq(trackedListings.listingId, params.trackedListingId),
                eq(trackedListings.tenantId, params.tenantId)
            )
        )
        .limit(1);

    if (!current) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Tracked listing was not found for this tenant.'
        });
    }

    try {
        const updated = await syncTrackedListingFromEtsy({
            clerkUserId: params.clerkUserId,
            etsyListingId: current.etsyListingId,
            tenantId: params.tenantId,
            trackerClerkUserId: params.trackerClerkUserId
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
                trackingState: 'error',
                updatedAt: new Date()
            })
            .where(eq(trackedListings.listingId, current.listingId))
            .returning();

        if (!updated) {
            throw error;
        }

        throw error;
    }
};

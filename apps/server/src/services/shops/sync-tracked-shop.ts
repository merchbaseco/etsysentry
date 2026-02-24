import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { trackedShopSnapshots, trackedShops } from '../../db/schema';
import { createEventLog, createEventLogs } from '../logs/create-event-log';
import { emitEvent } from '../realtime/emit-event';
import { DAILY_SYNC_INTERVAL_MS } from './types';
import {
    fetchChangedActiveListings,
    fetchShopFromEtsy
} from './sync-tracked-shop-fetch';
import {
    computeDelta,
    computeNextWatermark,
    discoverTrackedListings,
    upsertTrackedShopListings
} from './sync-tracked-shop-persistence';

export type SyncTrackedShopResult = {
    trackedShopId: string;
    etsyShopId: string;
    shopName: string;
    activeListingCount: number;
    changedListingCount: number;
    newListingCount: number;
    newlyDiscoveredEtsyListingIds: string[];
};

const getFailureMessage = (error: unknown): string => {
    if (error instanceof TRPCError) {
        return error.message;
    }

    if (error instanceof Error && error.message.length > 0) {
        return error.message;
    }

    return 'Unexpected tracked shop sync error.';
};

export const syncTrackedShop = async (params: {
    clerkUserId: string;
    monitorRunId?: string;
    requestId?: string;
    accountId: string;
    trackedShopId: string;
}): Promise<SyncTrackedShopResult> => {
    const [trackedShop] = await db
        .select()
        .from(trackedShops)
        .where(
            and(
                eq(trackedShops.accountId, params.accountId),
                eq(trackedShops.trackedShopId, params.trackedShopId)
            )
        )
        .limit(1);

    if (!trackedShop) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Tracked shop was not found for this account.'
        });
    }

    const now = new Date();
    const nextSyncAt = new Date(now.getTime() + DAILY_SYNC_INTERVAL_MS);

    try {
        const [previousSnapshot] = await db
            .select()
            .from(trackedShopSnapshots)
            .where(
                and(
                    eq(trackedShopSnapshots.accountId, params.accountId),
                    eq(trackedShopSnapshots.trackedShopId, params.trackedShopId)
                )
            )
            .orderBy(desc(trackedShopSnapshots.observedAt))
            .limit(1);

        const shopDetails = await fetchShopFromEtsy({
            clerkUserId: params.clerkUserId,
            etsyShopId: trackedShop.etsyShopId,
            accountId: params.accountId
        });

        const changedListings = await fetchChangedActiveListings({
            clerkUserId: params.clerkUserId,
            etsyShopId: trackedShop.etsyShopId,
            previousWatermark: trackedShop.lastSyncedListingUpdatedTimestamp,
            accountId: params.accountId
        });

        const newListingCount = await upsertTrackedShopListings({
            now,
            accountId: params.accountId,
            trackedShopId: trackedShop.trackedShopId,
            etsyShopId: trackedShop.etsyShopId,
            listings: changedListings
        });

        const discoveredListings = await discoverTrackedListings({
            now,
            clerkUserId: params.clerkUserId,
            accountId: params.accountId,
            etsyShopId: trackedShop.etsyShopId,
            listings: changedListings
        });

        await db.insert(trackedShopSnapshots).values({
            accountId: params.accountId,
            trackedShopId: trackedShop.trackedShopId,
            etsyShopId: trackedShop.etsyShopId,
            observedAt: now,
            activeListingCount: shopDetails.activeListingCount ?? 0,
            newListingCount,
            favoritesTotal: shopDetails.numFavorers,
            favoritesDelta: computeDelta(shopDetails.numFavorers, previousSnapshot?.favoritesTotal ?? null),
            soldTotal: shopDetails.soldCount,
            soldDelta: computeDelta(shopDetails.soldCount, previousSnapshot?.soldTotal ?? null),
            reviewTotal: shopDetails.reviewCount,
            reviewDelta: computeDelta(shopDetails.reviewCount, previousSnapshot?.reviewTotal ?? null),
            createdAt: now
        });

        await db
            .update(trackedShops)
            .set({
                shopName: shopDetails.shopName,
                shopUrl: shopDetails.url,
                trackingState: 'active',
                lastRefreshedAt: now,
                nextSyncAt,
                lastRefreshError: null,
                lastSyncedListingUpdatedTimestamp: computeNextWatermark({
                    changedListings,
                    previousWatermark: trackedShop.lastSyncedListingUpdatedTimestamp
                }),
                updatedAt: now
            })
            .where(eq(trackedShops.trackedShopId, trackedShop.trackedShopId));

        emitEvent({
            queries: ['app.shops.list', 'app.listings.list'],
            accountId: params.accountId
        });

        const listingById = new Map(changedListings.map((listing) => [listing.listingId, listing]));

        await createEventLogs([
            ...discoveredListings.map((listing) => ({
                action: 'listing.discovered',
                category: 'listing',
                clerkUserId: params.clerkUserId,
                detailsJson: {
                    shopId: trackedShop.etsyShopId,
                    shopName: trackedShop.shopName,
                    title: listingById.get(listing.etsyListingId)?.title ?? null
                },
                level: 'info' as const,
                listingId: listing.etsyListingId,
                message:
                    `Discovered listing ${listing.etsyListingId} from shop ` +
                    `${trackedShop.shopName} (${trackedShop.etsyShopId}).`,
                monitorRunId: params.monitorRunId ?? null,
                primitiveId: listing.listingId,
                primitiveType: 'listing' as const,
                requestId: params.requestId ?? null,
                shopId: trackedShop.etsyShopId,
                status: 'success' as const,
                accountId: params.accountId
            })),
            {
                action: 'shop.synced',
                category: 'shop',
                clerkUserId: params.clerkUserId,
                detailsJson: {
                    activeListingCount: shopDetails.activeListingCount ?? 0,
                    changedListingCount: changedListings.length,
                    discoveredCount: discoveredListings.length,
                    newListingCount
                },
                level: 'info',
                message:
                    `Synced shop ${trackedShop.shopName} (${trackedShop.etsyShopId}) ` +
                    `with ${changedListings.length} changed listings.`,
                monitorRunId: params.monitorRunId ?? null,
                primitiveId: trackedShop.trackedShopId,
                primitiveType: 'shop',
                requestId: params.requestId ?? null,
                shopId: trackedShop.etsyShopId,
                status: 'success',
                accountId: params.accountId
            }
        ]);

        return {
            trackedShopId: trackedShop.trackedShopId,
            etsyShopId: trackedShop.etsyShopId,
            shopName: trackedShop.shopName,
            activeListingCount: shopDetails.activeListingCount ?? 0,
            changedListingCount: changedListings.length,
            newListingCount,
            newlyDiscoveredEtsyListingIds: discoveredListings.map((item) => item.etsyListingId)
        };
    } catch (error) {
        const failureMessage = getFailureMessage(error);

        await db
            .update(trackedShops)
            .set({
                trackingState: 'error',
                lastRefreshError: failureMessage,
                lastRefreshedAt: now,
                nextSyncAt,
                updatedAt: now
            })
            .where(eq(trackedShops.trackedShopId, trackedShop.trackedShopId));

        emitEvent({
            queries: ['app.shops.list'],
            accountId: params.accountId
        });

        try {
            await createEventLog({
                action: 'shop.sync_failed',
                category: 'shop',
                clerkUserId: params.clerkUserId,
                detailsJson: {
                    error: failureMessage
                },
                level: 'error',
                message:
                    `Shop sync failed for ${trackedShop.shopName} (${trackedShop.etsyShopId}): ` +
                    failureMessage,
                monitorRunId: params.monitorRunId ?? null,
                primitiveId: trackedShop.trackedShopId,
                primitiveType: 'shop',
                requestId: params.requestId ?? null,
                shopId: trackedShop.etsyShopId,
                status: 'failed',
                accountId: params.accountId
            });
        } catch {
            // Preserve original failure.
        }

        throw error;
    }
};

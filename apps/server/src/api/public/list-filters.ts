import { z } from 'zod';
import type { TrackedKeywordRecord } from '../../services/keywords/tracked-keywords-service';
import type { TrackedListingRecord } from '../../services/listings/tracked-listings-service';
import type { TrackedShopRecord } from '../../services/shops/types';

const PUBLIC_LIST_SYNC_STATES = ['idle', 'queued', 'syncing'] as const;
const PUBLIC_LIST_TRACKING_STATES = ['active', 'paused', 'error'] as const;
const PUBLIC_LIST_LISTING_TRACKING_STATES = ['active', 'paused', 'error', 'fatal'] as const;

const publicListPageInputSchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).optional(),
    offset: z.coerce.number().int().min(0).optional(),
});

const publicListSearchSyncInputSchema = publicListPageInputSchema.extend({
    search: z.string().trim().min(1).optional(),
    syncState: z.enum(PUBLIC_LIST_SYNC_STATES).optional(),
});

export const publicKeywordsListInputSchema = publicListSearchSyncInputSchema.extend({
    trackingState: z.enum(PUBLIC_LIST_TRACKING_STATES).optional(),
});

export const publicShopsListInputSchema = publicListSearchSyncInputSchema.extend({
    trackingState: z.enum(PUBLIC_LIST_TRACKING_STATES).optional(),
});

export const publicListingsListInputSchema = publicListSearchSyncInputSchema.extend({
    showDigital: z.boolean().optional(),
    trackingState: z.enum(PUBLIC_LIST_LISTING_TRACKING_STATES).optional(),
});

export const publicShopListingsFilterInputSchema = publicListSearchSyncInputSchema.extend({
    trackingState: z.enum(PUBLIC_LIST_LISTING_TRACKING_STATES).optional(),
});

export type PublicKeywordsListInput = z.infer<typeof publicKeywordsListInputSchema>;
export type PublicShopsListInput = z.infer<typeof publicShopsListInputSchema>;
export type PublicListingsListInput = z.infer<typeof publicListingsListInputSchema>;
export type PublicShopListingsFilterInput = z.infer<typeof publicShopListingsFilterInputSchema>;

type ListingListItem = Pick<
    TrackedListingRecord,
    'etsyListingId' | 'isDigital' | 'shopName' | 'syncState' | 'title' | 'trackingState'
>;

const containsSearchText = (
    value: string | null | undefined,
    search: string | undefined
): boolean => {
    if (!search) {
        return true;
    }

    return (value ?? '').toLowerCase().includes(search.toLowerCase());
};

const paginateItems = <T>(
    items: T[],
    pagination: Pick<PublicKeywordsListInput, 'limit' | 'offset'>
): T[] => {
    const offset = pagination.offset ?? 0;

    if (pagination.limit === undefined) {
        return items.slice(offset);
    }

    return items.slice(offset, offset + pagination.limit);
};

export const filterPublicKeywordItems = (
    items: TrackedKeywordRecord[],
    input: PublicKeywordsListInput
): TrackedKeywordRecord[] => {
    return paginateItems(
        items.filter((item) => {
            if (input.trackingState && item.trackingState !== input.trackingState) {
                return false;
            }

            if (input.syncState && item.syncState !== input.syncState) {
                return false;
            }

            return containsSearchText(item.keyword, input.search);
        }),
        input
    );
};

export const filterPublicShopItems = (
    items: TrackedShopRecord[],
    input: PublicShopsListInput
): TrackedShopRecord[] => {
    return paginateItems(
        items.filter((item) => {
            if (input.trackingState && item.trackingState !== input.trackingState) {
                return false;
            }

            if (input.syncState && item.syncState !== input.syncState) {
                return false;
            }

            return (
                containsSearchText(item.shopName, input.search) ||
                containsSearchText(item.etsyShopId, input.search)
            );
        }),
        input
    );
};

export const filterPublicListingItems = <T extends ListingListItem>(
    items: T[],
    input: PublicListingsListInput
): T[] => {
    return paginateItems(
        items.filter((item) => {
            if (input.showDigital === false && item.isDigital) {
                return false;
            }

            if (input.trackingState && item.trackingState !== input.trackingState) {
                return false;
            }

            if (input.syncState && item.syncState !== input.syncState) {
                return false;
            }

            return (
                containsSearchText(item.title, input.search) ||
                containsSearchText(item.etsyListingId, input.search) ||
                containsSearchText(item.shopName, input.search)
            );
        }),
        input
    );
};

export const filterPublicShopListingItems = <T extends ListingListItem>(
    items: T[],
    input: PublicShopListingsFilterInput
): T[] => {
    return paginateItems(
        items.filter((item) => {
            if (input.trackingState && item.trackingState !== input.trackingState) {
                return false;
            }

            if (input.syncState && item.syncState !== input.syncState) {
                return false;
            }

            return (
                containsSearchText(item.title, input.search) ||
                containsSearchText(item.etsyListingId, input.search) ||
                containsSearchText(item.shopName, input.search)
            );
        }),
        input
    );
};

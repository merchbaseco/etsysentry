import type { TrackedListingItem } from '@/lib/listings-api';
import { TrpcRequestError } from '@/lib/trpc-http';

export const formatListingPrice = (item: TrackedListingItem): string => {
    if (!item.price) {
        return '--';
    }

    const nativeValue = (item.price.value || 0).toFixed(2);
    const usdValue =
        item.priceUsdValue !== null && item.priceUsdValue !== undefined
            ? item.priceUsdValue.toFixed(2)
            : null;

    if (usdValue !== null) {
        return `$${usdValue}`;
    }

    if (item.price.currencyCode === 'USD') {
        return `$${nativeValue}`;
    }

    return `${item.price.currencyCode} ${nativeValue}`;
};

export const toListingsErrorMessage = (error: unknown): string => {
    if (error instanceof TrpcRequestError) {
        return error.message;
    }

    if (error instanceof Error && error.message.length > 0) {
        return error.message;
    }

    return 'Unexpected request failure.';
};

export const upsertListingById = (
    items: TrackedListingItem[],
    nextItem: TrackedListingItem
): TrackedListingItem[] => {
    const existingIndex = items.findIndex((item) => item.id === nextItem.id);

    if (existingIndex === -1) {
        return [nextItem, ...items];
    }

    const clone = [...items];
    clone[existingIndex] = nextItem;

    return clone;
};

export const isListingSyncInFlight = (item: TrackedListingItem): boolean => {
    return item.syncState === 'queued' || item.syncState === 'syncing';
};

const arePricesEqual = (
    left: TrackedListingItem['price'],
    right: TrackedListingItem['price']
): boolean => {
    if (left === null || right === null) {
        return left === right;
    }

    return (
        left.amount === right.amount &&
        left.currencyCode === right.currencyCode &&
        left.divisor === right.divisor &&
        left.value === right.value
    );
};

const areTrackedListingsEqual = (
    left: TrackedListingItem,
    right: TrackedListingItem
): boolean => {
    return (
        left.accountId === right.accountId &&
        left.etsyListingId === right.etsyListingId &&
        left.etsyState === right.etsyState &&
        left.id === right.id &&
        left.isDigital === right.isDigital &&
        left.lastRefreshError === right.lastRefreshError &&
        left.lastRefreshedAt === right.lastRefreshedAt &&
        left.numFavorers === right.numFavorers &&
        arePricesEqual(left.price, right.price) &&
        left.priceUsdValue === right.priceUsdValue &&
        left.quantity === right.quantity &&
        left.shopId === right.shopId &&
        left.shopName === right.shopName &&
        left.thumbnailUrl === right.thumbnailUrl &&
        left.title === right.title &&
        left.trackerClerkUserId === right.trackerClerkUserId &&
        left.syncState === right.syncState &&
        left.trackingState === right.trackingState &&
        left.updatedAt === right.updatedAt &&
        left.updatedTimestamp === right.updatedTimestamp &&
        left.url === right.url &&
        left.views === right.views
    );
};

export const mergeTrackedListings = (
    currentItems: TrackedListingItem[],
    nextItems: TrackedListingItem[]
): TrackedListingItem[] => {
    const currentById = new Map(currentItems.map((item) => [item.id, item]));

    return nextItems.map((nextItem) => {
        const currentItem = currentById.get(nextItem.id);

        if (!currentItem) {
            return nextItem;
        }

        return areTrackedListingsEqual(currentItem, nextItem) ? currentItem : nextItem;
    });
};

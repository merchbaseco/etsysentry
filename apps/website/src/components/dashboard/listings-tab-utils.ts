import type { TrackedListingItem } from '@/lib/listings-api';
import { TrpcRequestError } from '@/lib/trpc-http';

export type ListingsFilterParams = {
    search: string;
    showPhysicalListings: boolean;
    showDigitalListings: boolean;
    priceRange: [number, number];
    favsRange: [number, number];
};

const DEFAULT_MIN_PRICE = 0;
const DEFAULT_MAX_PRICE = 40;
const DEFAULT_MIN_FAVS = 0;
const DEFAULT_MAX_FAVS = 5000;

export const LISTINGS_INITIAL_RENDER_COUNT = 200;
export const LISTINGS_RENDER_INCREMENT = 200;

export const toListingsInfiniteResetKey = (
    params: Pick<
        ListingsFilterParams,
        'search' | 'priceRange' | 'favsRange' | 'showDigitalListings' | 'showPhysicalListings'
    >
): string => {
    return [
        params.search,
        `${params.priceRange[0]}:${params.priceRange[1]}`,
        `${params.favsRange[0]}:${params.favsRange[1]}`,
        String(Number(params.showDigitalListings)),
        String(Number(params.showPhysicalListings))
    ].join('|');
};

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

export const filterTrackedListings = (
    items: TrackedListingItem[],
    params: ListingsFilterParams
): TrackedListingItem[] => {
    const query = params.search.trim().toLowerCase();
    const priceActive =
        params.priceRange[0] > DEFAULT_MIN_PRICE || params.priceRange[1] < DEFAULT_MAX_PRICE;
    const favsActive =
        params.favsRange[0] > DEFAULT_MIN_FAVS || params.favsRange[1] < DEFAULT_MAX_FAVS;

    return items.filter((item) => {
        if (item.isDigital && !params.showDigitalListings) {
            return false;
        }

        if (!item.isDigital && !params.showPhysicalListings) {
            return false;
        }

        if (priceActive) {
            const price = item.price?.value ?? null;
            if (price === null || price < params.priceRange[0] || price > params.priceRange[1]) {
                return false;
            }
        }

        if (favsActive) {
            if (
                item.numFavorers === null ||
                item.numFavorers < params.favsRange[0] ||
                item.numFavorers > params.favsRange[1]
            ) {
                return false;
            }
        }

        if (query.length === 0) {
            return true;
        }

        return (
            item.title.toLowerCase().includes(query) ||
            item.etsyListingId.includes(query) ||
            (item.shopName ?? '').toLowerCase().includes(query) ||
            (item.shopId ?? '').includes(query)
        );
    });
};

export const getInitialListingsRenderCount = (totalCount: number): number => {
    return Math.min(totalCount, LISTINGS_INITIAL_RENDER_COUNT);
};

export const getNextListingsRenderCount = (params: {
    currentCount: number;
    totalCount: number;
    incrementSize?: number;
}): number => {
    const incrementSize = params.incrementSize ?? LISTINGS_RENDER_INCREMENT;

    return Math.min(params.totalCount, params.currentCount + incrementSize);
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

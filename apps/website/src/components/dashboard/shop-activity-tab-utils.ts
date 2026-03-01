import type { ShopActivitySortOrder } from '@/lib/shops-api';

export const shopOverviewQueryKey = (etsyShopId: string) =>
    ['shop-activity-overview', etsyShopId] as const;

export const shopListingsQueryKey = (etsyShopId: string, sortOrder: ShopActivitySortOrder) =>
    ['shop-activity-listings', etsyShopId, sortOrder] as const;

export const toShopTitle = (params: {
    etsyShopId: string | undefined;
    listingsShopName: string | null | undefined;
    locationShopName: string | undefined;
    overviewShopName: string | null | undefined;
}): string => {
    const fromOverview = params.overviewShopName?.trim();

    if (fromOverview) {
        return fromOverview;
    }

    const fromListings = params.listingsShopName?.trim();

    if (fromListings) {
        return fromListings;
    }

    const fromLocation = params.locationShopName?.trim();

    if (fromLocation) {
        return fromLocation;
    }

    const fromPath = params.etsyShopId?.trim();

    if (fromPath) {
        return `Shop ${fromPath}`;
    }

    return 'Shop Activity';
};

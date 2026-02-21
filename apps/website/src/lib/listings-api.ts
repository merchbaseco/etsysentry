import { trpcMutation, trpcQuery } from './trpc-http';

export type TrackedListingItem = {
    etsyListingId: string;
    etsyState: 'active' | 'inactive' | 'sold_out' | 'draft' | 'expired';
    id: string;
    lastRefreshError: string | null;
    lastRefreshedAt: string;
    numFavorers: number | null;
    price: {
        amount: number;
        currencyCode: string;
        divisor: number;
        value: number;
    } | null;
    quantity: number | null;
    shopId: string | null;
    tenantId: string;
    title: string;
    trackerClerkUserId: string;
    trackingState: 'active' | 'paused' | 'error';
    updatedAt: string;
    updatedTimestamp: number | null;
    url: string | null;
    views: number | null;
};

export type ListTrackedListingsInput = {
    tenantId: string;
    trackerClerkUserId?: string;
};

export type ListTrackedListingsOutput = {
    items: TrackedListingItem[];
};

export type TrackListingInput = {
    listing: string;
    oauthSessionId: string;
    tenantId: string;
    trackerClerkUserId: string;
};

export type TrackListingOutput = {
    created: boolean;
    item: TrackedListingItem;
};

export type RefreshTrackedListingInput = {
    oauthSessionId: string;
    tenantId: string;
    trackedListingId: string;
    trackerClerkUserId: string;
};

export const listTrackedListings = async (
    params: ListTrackedListingsInput
): Promise<ListTrackedListingsOutput> => {
    return trpcQuery<typeof params, ListTrackedListingsOutput>('app.listings.list', params);
};

export const trackListing = async (params: TrackListingInput): Promise<TrackListingOutput> => {
    return trpcMutation<typeof params, TrackListingOutput>('app.listings.track', params);
};

export const refreshTrackedListing = async (
    params: RefreshTrackedListingInput
): Promise<TrackedListingItem> => {
    return trpcMutation<typeof params, TrackedListingItem>('app.listings.refresh', params);
};

import { queryClient, trpc } from './trpc-client';
import { toTrpcRequestError } from './trpc-http';

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
    shopName: string | null;
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
    [key: string]: never;
};

export type ListTrackedListingsOutput = {
    items: TrackedListingItem[];
};

export type TrackListingInput = {
    listing: string;
};

export type TrackListingOutput = {
    created: boolean;
    item: TrackedListingItem;
};

export type RefreshTrackedListingInput = {
    trackedListingId: string;
};

export type GetKeywordRanksForProductInput = {
    listing: string;
};

export type KeywordRankForProduct = {
    bestRank: number;
    currentRank: number;
    daysSeen: number;
    firstObservedAt: string;
    keyword: string;
    latestObservedAt: string;
    normalizedKeyword: string;
    trackedKeywordId: string;
};

export type GetKeywordRanksForProductOutput = {
    etsyListingId: string;
    items: KeywordRankForProduct[];
};

const executeMutation = async <TInput, TOutput>(
    input: TInput,
    options: {
        mutationFn?: (nextInput: TInput) => Promise<TOutput>;
    }
): Promise<TOutput> => {
    if (!options.mutationFn) {
        throw new Error('tRPC mutation function was not configured.');
    }

    return options.mutationFn(input);
};

export const listTrackedListings = async (
    params: ListTrackedListingsInput = {}
): Promise<ListTrackedListingsOutput> => {
    try {
        const response = await queryClient.fetchQuery(trpc.app.listings.list.queryOptions(params));
        return response as ListTrackedListingsOutput;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const trackListing = async (params: TrackListingInput): Promise<TrackListingOutput> => {
    try {
        const response = await executeMutation<TrackListingInput, TrackListingOutput>(
            params,
            trpc.app.listings.track.mutationOptions()
        );

        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const refreshTrackedListing = async (
    params: RefreshTrackedListingInput
): Promise<TrackedListingItem> => {
    try {
        const response = await executeMutation<RefreshTrackedListingInput, TrackedListingItem>(
            params,
            trpc.app.listings.refresh.mutationOptions()
        );

        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const getKeywordRanksForProduct = async (
    params: GetKeywordRanksForProductInput
): Promise<GetKeywordRanksForProductOutput> => {
    try {
        const response = await queryClient.fetchQuery(
            trpc.app.listings.getKeywordRanksForProduct.queryOptions(params)
        );
        return response as GetKeywordRanksForProductOutput;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

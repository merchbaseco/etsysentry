import { queryClient, trpc } from './trpc-client';
import { toTrpcRequestError } from './trpc-http';

export type TrackedKeywordItem = {
    id: string;
    keyword: string;
    lastRefreshError: string | null;
    lastRefreshedAt: string;
    normalizedKeyword: string;
    tenantId: string;
    trackerClerkUserId: string;
    trackingState: 'active' | 'paused' | 'error';
    updatedAt: string;
};

export type ListTrackedKeywordsInput = {
    [key: string]: never;
};

export type ListTrackedKeywordsOutput = {
    items: TrackedKeywordItem[];
};

export type TrackKeywordInput = {
    keyword: string;
};

export type TrackKeywordOutput = {
    created: boolean;
    item: TrackedKeywordItem;
};

export type KeywordRankResultItem = {
    etsyListingId: string;
    observedAt: string;
    rank: number;
    trackedKeywordId: string;
};

export type DailyProductRanksForKeyword = {
    keyword: string;
    normalizedKeyword: string;
    observedAt: string | null;
    trackedKeywordId: string;
    items: KeywordRankResultItem[];
};

export type GetDailyProductRanksForKeywordInput = {
    trackedKeywordId: string;
};

export type SyncRanksForKeywordInput = {
    trackedKeywordId: string;
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

export const listTrackedKeywords = async (
    params: ListTrackedKeywordsInput = {}
): Promise<ListTrackedKeywordsOutput> => {
    try {
        const response = await queryClient.fetchQuery(trpc.app.keywords.list.queryOptions(params));
        return response as ListTrackedKeywordsOutput;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const trackKeyword = async (params: TrackKeywordInput): Promise<TrackKeywordOutput> => {
    try {
        const response = await executeMutation<TrackKeywordInput, TrackKeywordOutput>(
            params,
            trpc.app.keywords.track.mutationOptions()
        );

        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const getDailyProductRanksForKeyword = async (
    params: GetDailyProductRanksForKeywordInput
): Promise<DailyProductRanksForKeyword> => {
    try {
        const response = await queryClient.fetchQuery(
            trpc.app.keywords.getDailyProductRanksForKeyword.queryOptions(params)
        );
        return response as DailyProductRanksForKeyword;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const syncRanksForKeyword = async (
    params: SyncRanksForKeywordInput
): Promise<DailyProductRanksForKeyword> => {
    try {
        const response = await executeMutation<SyncRanksForKeywordInput, DailyProductRanksForKeyword>(
            params,
            trpc.app.keywords.syncRanksForKeyword.mutationOptions()
        );

        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

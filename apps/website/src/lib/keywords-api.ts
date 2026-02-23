import { queryClient, trpc, trpcClient } from './trpc-client';
import {
    type InferProcedureInput,
    type InferProcedureOutput
} from './trpc-inference';
import { toTrpcRequestError } from './trpc-http';

export type ListTrackedKeywordsInput = InferProcedureInput<typeof trpcClient.app.keywords.list.query>;

export type ListTrackedKeywordsOutput = InferProcedureOutput<typeof trpcClient.app.keywords.list.query>;

export type TrackedKeywordItem = ListTrackedKeywordsOutput['items'][number];

export type TrackKeywordInput = InferProcedureInput<typeof trpcClient.app.keywords.track.mutate>;

export type TrackKeywordOutput = InferProcedureOutput<typeof trpcClient.app.keywords.track.mutate>;

export type GetDailyProductRanksForKeywordInput = InferProcedureInput<
    typeof trpcClient.app.keywords.getDailyProductRanksForKeyword.query
>;

export type DailyProductRanksForKeyword = InferProcedureOutput<
    typeof trpcClient.app.keywords.getDailyProductRanksForKeyword.query
>;

export type KeywordRankResultItem = DailyProductRanksForKeyword['items'][number];

export const listTrackedKeywords = async (
    params: ListTrackedKeywordsInput = {}
): Promise<ListTrackedKeywordsOutput> => {
    try {
        const response = await queryClient.fetchQuery(trpc.app.keywords.list.queryOptions(params));
        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const trackKeyword = async (params: TrackKeywordInput): Promise<TrackKeywordOutput> => {
    try {
        const response = await trpcClient.app.keywords.track.mutate(params);

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
        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

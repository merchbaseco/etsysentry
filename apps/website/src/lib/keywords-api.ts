import type { trpcClient } from './trpc-client';
import type { InferProcedureInput, InferProcedureOutput } from './trpc-inference';

export type ListTrackedKeywordsInput = InferProcedureInput<
    typeof trpcClient.app.keywords.list.query
>;

export type ListTrackedKeywordsOutput = InferProcedureOutput<
    typeof trpcClient.app.keywords.list.query
>;

export type TrackedKeywordItem = ListTrackedKeywordsOutput['items'][number];

export type TrackKeywordInput = InferProcedureInput<typeof trpcClient.app.keywords.track.mutate>;

export type TrackKeywordOutput = InferProcedureOutput<typeof trpcClient.app.keywords.track.mutate>;

export type RefreshTrackedKeywordInput = InferProcedureInput<
    typeof trpcClient.app.keywords.refresh.mutate
>;

export type GetDailyProductRanksForKeywordInput = InferProcedureInput<
    typeof trpcClient.app.keywords.getDailyProductRanksForKeyword.query
>;

export type DailyProductRanksForKeyword = InferProcedureOutput<
    typeof trpcClient.app.keywords.getDailyProductRanksForKeyword.query
>;

export type KeywordRankResultItem = DailyProductRanksForKeyword['items'][number];

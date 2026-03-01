import type { trpcClient } from './trpc-client';
import type { InferProcedureInput, InferProcedureOutput } from './trpc-inference';

export type ListTrackedListingsInput = InferProcedureInput<
    typeof trpcClient.app.listings.list.query
>;

export type ListTrackedListingsOutput = InferProcedureOutput<
    typeof trpcClient.app.listings.list.query
>;

export type TrackListingInput = InferProcedureInput<typeof trpcClient.app.listings.track.mutate>;

export type TrackListingOutput = InferProcedureOutput<typeof trpcClient.app.listings.track.mutate>;

export type RefreshTrackedListingInput = InferProcedureInput<
    typeof trpcClient.app.listings.refresh.mutate
>;

export type RefreshManyTrackedListingsInput = InferProcedureInput<
    typeof trpcClient.app.listings.refreshMany.mutate
>;

export type TrackedListingItem = ListTrackedListingsOutput['items'][number];

export type GetKeywordRanksForProductInput = InferProcedureInput<
    typeof trpcClient.app.listings.getKeywordRanksForProduct.query
>;

export type GetKeywordRanksForProductOutput = InferProcedureOutput<
    typeof trpcClient.app.listings.getKeywordRanksForProduct.query
>;

export type GetTrackedListingMetricHistoryInput = InferProcedureInput<
    typeof trpcClient.app.listings.getMetricHistory.query
>;

export type GetTrackedListingMetricHistoryOutput = InferProcedureOutput<
    typeof trpcClient.app.listings.getMetricHistory.query
>;

export type GetListingRefreshPolicyOutput = InferProcedureOutput<
    typeof trpcClient.app.listings.getRefreshPolicy.query
>;

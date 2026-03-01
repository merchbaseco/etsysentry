import type { trpcClient } from './trpc-client';
import type { InferProcedureInput, InferProcedureOutput } from './trpc-inference';

export type ListTrackedShopsInput = InferProcedureInput<typeof trpcClient.app.shops.list.query>;

export type ListTrackedShopsOutput = InferProcedureOutput<typeof trpcClient.app.shops.list.query>;

export type TrackedShopItem = ListTrackedShopsOutput['items'][number];

export type TrackShopInput = InferProcedureInput<typeof trpcClient.app.shops.track.mutate>;

export type TrackShopOutput = InferProcedureOutput<typeof trpcClient.app.shops.track.mutate>;

export type RefreshTrackedShopInput = InferProcedureInput<
    typeof trpcClient.app.shops.refresh.mutate
>;

export type GetShopActivityOverviewInput = InferProcedureInput<
    typeof trpcClient.app.shops.getOverview.query
>;

export type GetShopActivityOverviewOutput = InferProcedureOutput<
    typeof trpcClient.app.shops.getOverview.query
>;

export type ListShopActivityListingsInput = InferProcedureInput<
    typeof trpcClient.app.shops.listListings.query
>;

export type ListShopActivityListingsOutput = InferProcedureOutput<
    typeof trpcClient.app.shops.listListings.query
>;

export type ShopActivitySortOrder = ListShopActivityListingsInput['sortOrder'];

export type ShopActivityOverview = GetShopActivityOverviewOutput['overview'];

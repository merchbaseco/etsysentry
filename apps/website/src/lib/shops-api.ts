import { queryClient, trpc, trpcClient } from './trpc-client';
import {
    type InferProcedureInput,
    type InferProcedureOutput
} from './trpc-inference';
import { toTrpcRequestError } from './trpc-http';

export type ListTrackedShopsInput = InferProcedureInput<typeof trpcClient.app.shops.list.query>;

export type ListTrackedShopsOutput = InferProcedureOutput<typeof trpcClient.app.shops.list.query>;

export type TrackedShopItem = ListTrackedShopsOutput['items'][number];

export type TrackShopInput = InferProcedureInput<typeof trpcClient.app.shops.track.mutate>;

export type TrackShopOutput = InferProcedureOutput<typeof trpcClient.app.shops.track.mutate>;

export type RefreshTrackedShopInput = InferProcedureInput<typeof trpcClient.app.shops.refresh.mutate>;

export const listTrackedShops = async (
    params: ListTrackedShopsInput = {}
): Promise<ListTrackedShopsOutput> => {
    try {
        const response = await queryClient.fetchQuery(trpc.app.shops.list.queryOptions(params));
        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const trackShop = async (params: TrackShopInput): Promise<TrackShopOutput> => {
    try {
        const response = await trpcClient.app.shops.track.mutate(params);

        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const refreshTrackedShop = async (
    params: RefreshTrackedShopInput
): Promise<TrackedShopItem> => {
    try {
        const response = await trpcClient.app.shops.refresh.mutate(params);

        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

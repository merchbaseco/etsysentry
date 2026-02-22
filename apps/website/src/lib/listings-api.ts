import { queryClient, trpc, trpcClient } from './trpc-client';
import {
    type InferProcedureInput,
    type InferProcedureOutput
} from './trpc-inference';
import { toTrpcRequestError } from './trpc-http';

export type ListTrackedListingsInput = InferProcedureInput<typeof trpcClient.app.listings.list.query>;

export type ListTrackedListingsOutput = InferProcedureOutput<typeof trpcClient.app.listings.list.query>;

export type TrackListingInput = InferProcedureInput<typeof trpcClient.app.listings.track.mutate>;

export type TrackListingOutput = InferProcedureOutput<typeof trpcClient.app.listings.track.mutate>;

export type RefreshTrackedListingInput = InferProcedureInput<typeof trpcClient.app.listings.refresh.mutate>;

export type TrackedListingItem = ListTrackedListingsOutput['items'][number];

export type GetKeywordRanksForProductInput = InferProcedureInput<
    typeof trpcClient.app.listings.getKeywordRanksForProduct.query
>;

export type GetKeywordRanksForProductOutput = InferProcedureOutput<
    typeof trpcClient.app.listings.getKeywordRanksForProduct.query
>;

export const listTrackedListings = async (
    params: ListTrackedListingsInput = {}
): Promise<ListTrackedListingsOutput> => {
    try {
        const response = await queryClient.fetchQuery(trpc.app.listings.list.queryOptions(params));
        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const trackListing = async (params: TrackListingInput): Promise<TrackListingOutput> => {
    try {
        const response = await trpcClient.app.listings.track.mutate(params);

        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const refreshTrackedListing = async (
    params: RefreshTrackedListingInput
): Promise<TrackedListingItem> => {
    try {
        const response = await trpcClient.app.listings.refresh.mutate(params);

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
        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

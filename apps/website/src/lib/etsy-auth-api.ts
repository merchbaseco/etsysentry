import { queryClient, trpc, trpcClient } from './trpc-client';
import { toTrpcRequestError } from './trpc-http';
import type { InferProcedureOutput } from './trpc-inference';

export type EtsyAuthStatus = InferProcedureOutput<typeof trpcClient.app.etsyAuth.status.query>;

export type EtsyAuthStartResponse = InferProcedureOutput<
    typeof trpcClient.app.etsyAuth.start.mutate
>;

export const startEtsyAuth = async (): Promise<EtsyAuthStartResponse> => {
    try {
        const response = await trpcClient.app.etsyAuth.start.mutate({});

        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const getEtsyAuthStatus = async (): Promise<EtsyAuthStatus> => {
    try {
        const response = await queryClient.fetchQuery(trpc.app.etsyAuth.status.queryOptions({}));
        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const refreshEtsyAuth = async (): Promise<EtsyAuthStatus> => {
    try {
        const response = await trpcClient.app.etsyAuth.refresh.mutate({});

        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const disconnectEtsyAuth = async (): Promise<EtsyAuthStatus> => {
    try {
        const response = await trpcClient.app.etsyAuth.disconnect.mutate({});

        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

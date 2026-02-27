import { queryClient, trpc, trpcClient } from './trpc-client';
import { toTrpcRequestError } from './trpc-http';
import type { InferProcedureOutput } from './trpc-inference';

export type AdminStatus = InferProcedureOutput<typeof trpcClient.app.admin.status.query>;

export type EnqueueSyncAllListingsOutput = InferProcedureOutput<
    typeof trpcClient.app.admin.enqueueSyncAllListings.mutate
>;

export type EtsyApiUsage = InferProcedureOutput<typeof trpcClient.app.admin.getEtsyApiUsage.query>;

const adminStatusQueryOptions = {
    ...trpc.app.admin.status.queryOptions({}),
    gcTime: Number.POSITIVE_INFINITY,
    staleTime: Number.POSITIVE_INFINITY,
};

export const getAdminStatus = async (): Promise<AdminStatus> => {
    try {
        return await queryClient.fetchQuery(adminStatusQueryOptions);
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const clearCachedAdminStatus = (): void => {
    queryClient.removeQueries({
        queryKey: adminStatusQueryOptions.queryKey,
    });
};

export const enqueueSyncAllListings = async (): Promise<EnqueueSyncAllListingsOutput> => {
    try {
        return await trpcClient.app.admin.enqueueSyncAllListings.mutate({});
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const getEtsyApiUsage = async (): Promise<EtsyApiUsage> => {
    try {
        return await trpcClient.app.admin.getEtsyApiUsage.query({});
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

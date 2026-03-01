import { queryClient, trpc, type trpcClient } from './trpc-client';
import type { InferProcedureOutput } from './trpc-inference';

export type AdminStatus = InferProcedureOutput<typeof trpcClient.app.admin.status.query>;

export type EnqueueSyncAllListingsOutput = InferProcedureOutput<
    typeof trpcClient.app.admin.enqueueSyncAllListings.mutate
>;

export type EtsyApiUsage = InferProcedureOutput<typeof trpcClient.app.admin.getEtsyApiUsage.query>;

export const clearCachedAdminStatus = (): void => {
    queryClient.removeQueries({
        queryKey: trpc.app.admin.status.queryOptions({}).queryKey,
    });
};

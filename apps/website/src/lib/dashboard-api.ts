import { queryClient, trpc, type trpcClient } from './trpc-client';
import { toTrpcRequestError } from './trpc-http';
import type { InferProcedureOutput } from './trpc-inference';

export type DashboardSummary = InferProcedureOutput<
    typeof trpcClient.app.dashboard.getSummary.query
>;

export const getDashboardSummary = async (): Promise<DashboardSummary> => {
    try {
        const response = await queryClient.fetchQuery(
            trpc.app.dashboard.getSummary.queryOptions({})
        );
        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

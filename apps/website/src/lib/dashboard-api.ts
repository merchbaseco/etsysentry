import { queryClient, trpc, trpcClient } from './trpc-client';
import { type InferProcedureOutput } from './trpc-inference';
import { toTrpcRequestError } from './trpc-http';

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

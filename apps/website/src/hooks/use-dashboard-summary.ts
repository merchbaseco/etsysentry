import { useQuery } from '@tanstack/react-query';
import { trpc, trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

interface UseDashboardSummaryOptions {
    enabled?: boolean;
    refetchInterval?: number;
}

export const useDashboardSummary = (options: UseDashboardSummaryOptions = {}) => {
    const queryKey = trpc.app.dashboard.getSummary.queryOptions({}).queryKey;

    return useQuery({
        enabled: options.enabled,
        queryFn: async () => {
            try {
                return await trpcClient.app.dashboard.getSummary.query({});
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
        queryKey,
        refetchInterval: options.refetchInterval,
    });
};

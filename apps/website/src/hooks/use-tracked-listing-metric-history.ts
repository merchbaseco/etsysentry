import { useQuery } from '@tanstack/react-query';
import type { GetTrackedListingMetricHistoryInput } from '@/lib/listings-api';
import { trpc, trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

interface UseTrackedListingMetricHistoryOptions {
    enabled?: boolean;
    refetchInterval?: number;
}

export const useTrackedListingMetricHistory = (
    params: GetTrackedListingMetricHistoryInput,
    options: UseTrackedListingMetricHistoryOptions = {}
) => {
    const queryKey = trpc.app.listings.getMetricHistory.queryOptions(params).queryKey;

    return useQuery({
        enabled: options.enabled,
        queryFn: async () => {
            try {
                return await trpcClient.app.listings.getMetricHistory.query(params);
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
        queryKey,
        refetchInterval: options.refetchInterval,
    });
};

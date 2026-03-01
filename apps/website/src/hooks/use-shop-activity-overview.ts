import { useQuery } from '@tanstack/react-query';
import type { GetShopActivityOverviewInput } from '@/lib/shops-api';
import { trpc, trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

interface UseShopActivityOverviewOptions {
    enabled?: boolean;
    refetchInterval?: number;
}

export const useShopActivityOverview = (
    params: GetShopActivityOverviewInput,
    options: UseShopActivityOverviewOptions = {}
) => {
    const queryKey = trpc.app.shops.getOverview.queryOptions(params).queryKey;

    return useQuery({
        enabled: options.enabled,
        queryFn: async () => {
            try {
                return await trpcClient.app.shops.getOverview.query(params);
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
        queryKey,
        refetchInterval: options.refetchInterval,
    });
};

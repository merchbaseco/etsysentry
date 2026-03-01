import { useQuery } from '@tanstack/react-query';
import type { ListShopActivityListingsInput } from '@/lib/shops-api';
import { trpc, trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

interface UseShopActivityListingsOptions {
    enabled?: boolean;
    refetchInterval?: number;
}

export const useShopActivityListings = (
    params: ListShopActivityListingsInput,
    options: UseShopActivityListingsOptions = {}
) => {
    const queryKey = trpc.app.shops.listListings.queryOptions(params).queryKey;

    return useQuery({
        enabled: options.enabled,
        queryFn: async () => {
            try {
                return await trpcClient.app.shops.listListings.query(params);
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
        queryKey,
        refetchInterval: options.refetchInterval,
    });
};

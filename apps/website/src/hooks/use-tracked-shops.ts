import { useQuery } from '@tanstack/react-query';
import type { ListTrackedShopsInput } from '@/lib/shops-api';
import { trpc, trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

interface UseTrackedShopsOptions {
    enabled?: boolean;
    refetchInterval?: number;
}

export const useTrackedShops = (
    params: ListTrackedShopsInput = {},
    options: UseTrackedShopsOptions = {}
) => {
    const queryKey = trpc.app.shops.list.queryOptions(params).queryKey;

    return useQuery({
        enabled: options.enabled,
        queryFn: async () => {
            try {
                return await trpcClient.app.shops.list.query(params);
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
        queryKey,
        refetchInterval: options.refetchInterval,
    });
};

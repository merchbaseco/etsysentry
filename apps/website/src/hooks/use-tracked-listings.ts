import { useQuery } from '@tanstack/react-query';
import type { ListTrackedListingsInput } from '@/lib/listings-api';
import { trpc, trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

interface UseTrackedListingsOptions {
    enabled?: boolean;
    refetchInterval?: number;
}

export const useTrackedListings = (
    params: ListTrackedListingsInput = {},
    options: UseTrackedListingsOptions = {}
) => {
    const queryKey = trpc.app.listings.list.queryOptions(params).queryKey;

    return useQuery({
        enabled: options.enabled,
        queryFn: async () => {
            try {
                return await trpcClient.app.listings.list.query(params);
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
        queryKey,
        refetchInterval: options.refetchInterval,
    });
};

import { useQuery } from '@tanstack/react-query';
import { trpc, trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

interface UseListingRefreshPolicyOptions {
    enabled?: boolean;
    refetchInterval?: number;
}

export const useListingRefreshPolicy = (options: UseListingRefreshPolicyOptions = {}) => {
    const queryKey = trpc.app.listings.getRefreshPolicy.queryOptions({}).queryKey;

    return useQuery({
        enabled: options.enabled,
        queryFn: async () => {
            try {
                return await trpcClient.app.listings.getRefreshPolicy.query({});
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
        queryKey,
        refetchInterval: options.refetchInterval,
    });
};

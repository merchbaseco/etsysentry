import { useQuery } from '@tanstack/react-query';
import type { GetKeywordRanksForProductInput } from '@/lib/listings-api';
import { trpc, trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

interface UseKeywordRanksForProductOptions {
    enabled?: boolean;
    refetchInterval?: number;
}

export const useKeywordRanksForProduct = (
    params: GetKeywordRanksForProductInput,
    options: UseKeywordRanksForProductOptions = {}
) => {
    const queryKey = trpc.app.listings.getKeywordRanksForProduct.queryOptions(params).queryKey;

    return useQuery({
        enabled: options.enabled,
        queryFn: async () => {
            try {
                return await trpcClient.app.listings.getKeywordRanksForProduct.query(params);
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
        queryKey,
        refetchInterval: options.refetchInterval,
    });
};

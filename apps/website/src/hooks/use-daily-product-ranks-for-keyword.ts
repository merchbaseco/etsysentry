import { useQuery } from '@tanstack/react-query';
import type { GetDailyProductRanksForKeywordInput } from '@/lib/keywords-api';
import { trpc, trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

interface UseDailyProductRanksForKeywordOptions {
    enabled?: boolean;
    refetchInterval?: number;
}

export const useDailyProductRanksForKeyword = (
    params: GetDailyProductRanksForKeywordInput,
    options: UseDailyProductRanksForKeywordOptions = {}
) => {
    const queryKey = trpc.app.keywords.getDailyProductRanksForKeyword.queryOptions(params).queryKey;

    return useQuery({
        enabled: options.enabled,
        queryFn: async () => {
            try {
                return await trpcClient.app.keywords.getDailyProductRanksForKeyword.query(params);
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
        queryKey,
        refetchInterval: options.refetchInterval,
    });
};

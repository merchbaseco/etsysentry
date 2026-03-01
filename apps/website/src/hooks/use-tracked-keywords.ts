import { useQuery } from '@tanstack/react-query';
import type { ListTrackedKeywordsInput } from '@/lib/keywords-api';
import { trpc, trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

interface UseTrackedKeywordsOptions {
    enabled?: boolean;
    refetchInterval?: number;
}

export const useTrackedKeywords = (
    params: ListTrackedKeywordsInput = {},
    options: UseTrackedKeywordsOptions = {}
) => {
    const queryKey = trpc.app.keywords.list.queryOptions(params).queryKey;

    return useQuery({
        enabled: options.enabled,
        queryFn: async () => {
            try {
                return await trpcClient.app.keywords.list.query(params);
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
        queryKey,
        refetchInterval: options.refetchInterval,
    });
};

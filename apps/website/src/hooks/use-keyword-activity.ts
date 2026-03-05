import { useQuery } from '@tanstack/react-query';
import type { GetKeywordActivityInput } from '@/lib/keywords-api';
import { trpc, trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

interface UseKeywordActivityOptions {
    enabled?: boolean;
    refetchInterval?: number;
}

export const useKeywordActivity = (
    params: GetKeywordActivityInput,
    options: UseKeywordActivityOptions = {}
) => {
    const queryKey = trpc.app.keywords.getActivity.queryOptions(params).queryKey;

    return useQuery({
        enabled: options.enabled,
        queryFn: async () => {
            try {
                return await trpcClient.app.keywords.getActivity.query(params);
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
        queryKey,
        refetchInterval: options.refetchInterval,
    });
};

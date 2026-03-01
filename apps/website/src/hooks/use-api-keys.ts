import { useQuery } from '@tanstack/react-query';
import { trpc, trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

interface UseApiKeysOptions {
    enabled?: boolean;
    refetchInterval?: number;
}

export const useApiKeys = (options: UseApiKeysOptions = {}) => {
    const queryKey = trpc.app.apiKeys.list.queryOptions({}).queryKey;

    return useQuery({
        enabled: options.enabled,
        queryFn: async () => {
            try {
                return await trpcClient.app.apiKeys.list.query({});
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
        queryKey,
        refetchInterval: options.refetchInterval,
    });
};

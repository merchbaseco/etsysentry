import { useQuery } from '@tanstack/react-query';
import { trpc, trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

interface UseEtsyApiUsageOptions {
    enabled?: boolean;
    refetchInterval?: number;
}

export const useEtsyApiUsage = (options: UseEtsyApiUsageOptions = {}) => {
    const queryKey = trpc.app.admin.getEtsyApiUsage.queryOptions({}).queryKey;

    return useQuery({
        enabled: options.enabled,
        queryFn: async () => {
            try {
                return await trpcClient.app.admin.getEtsyApiUsage.query({});
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
        queryKey,
        refetchInterval: options.refetchInterval,
    });
};

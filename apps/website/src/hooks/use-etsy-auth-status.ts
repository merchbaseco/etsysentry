import { useQuery } from '@tanstack/react-query';
import { trpc, trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

interface UseEtsyAuthStatusOptions {
    enabled?: boolean;
    refetchInterval?: number;
}

export const useEtsyAuthStatus = (options: UseEtsyAuthStatusOptions = {}) => {
    const queryKey = trpc.app.etsyAuth.status.queryOptions({}).queryKey;

    return useQuery({
        enabled: options.enabled,
        queryFn: async () => {
            try {
                return await trpcClient.app.etsyAuth.status.query({});
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
        queryKey,
        refetchInterval: options.refetchInterval,
    });
};

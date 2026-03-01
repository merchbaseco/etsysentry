import { useQuery } from '@tanstack/react-query';
import { trpc, trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

interface UseCurrencyStatusOptions {
    enabled?: boolean;
    refetchInterval?: number;
}

export const useCurrencyStatus = (options: UseCurrencyStatusOptions = {}) => {
    const queryKey = trpc.app.currency.getStatus.queryOptions({}).queryKey;

    return useQuery({
        enabled: options.enabled,
        queryFn: async () => {
            try {
                return await trpcClient.app.currency.getStatus.query({});
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
        queryKey,
        refetchInterval: options.refetchInterval,
    });
};

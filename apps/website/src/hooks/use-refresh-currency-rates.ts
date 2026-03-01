import { useMutation } from '@tanstack/react-query';
import { queryClient, trpc, trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

export const useRefreshCurrencyRates = () => {
    return useMutation({
        mutationFn: async () => {
            try {
                return await trpcClient.app.currency.refresh.mutate({});
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
        onSuccess: async (response) => {
            queryClient.setQueryData(
                trpc.app.currency.getStatus.queryOptions({}).queryKey,
                response
            );
            await queryClient.invalidateQueries({
                queryKey: trpc.app.listings.list.queryOptions({}).queryKey,
            });
        },
    });
};

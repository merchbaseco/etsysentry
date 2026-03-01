import { useMutation } from '@tanstack/react-query';
import type { RefreshTrackedShopInput } from '@/lib/shops-api';
import { trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

export const useRefreshTrackedShop = () => {
    return useMutation({
        mutationFn: async (params: RefreshTrackedShopInput) => {
            try {
                return await trpcClient.app.shops.refresh.mutate(params);
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
    });
};

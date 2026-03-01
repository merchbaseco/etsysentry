import { useMutation } from '@tanstack/react-query';
import type { RefreshManyTrackedListingsInput } from '@/lib/listings-api';
import { trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

export const useRefreshManyTrackedListings = () => {
    return useMutation({
        mutationFn: async (params: RefreshManyTrackedListingsInput) => {
            try {
                return await trpcClient.app.listings.refreshMany.mutate(params);
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
    });
};

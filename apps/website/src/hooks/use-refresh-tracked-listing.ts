import { useMutation } from '@tanstack/react-query';
import type { RefreshTrackedListingInput } from '@/lib/listings-api';
import { trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

export const useRefreshTrackedListing = () => {
    return useMutation({
        mutationFn: async (params: RefreshTrackedListingInput) => {
            try {
                return await trpcClient.app.listings.refresh.mutate(params);
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
    });
};

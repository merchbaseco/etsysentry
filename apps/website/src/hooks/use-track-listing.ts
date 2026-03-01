import { useMutation } from '@tanstack/react-query';
import type { TrackListingInput } from '@/lib/listings-api';
import { trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

export const useTrackListing = () => {
    return useMutation({
        mutationFn: async (params: TrackListingInput) => {
            try {
                return await trpcClient.app.listings.track.mutate(params);
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
    });
};

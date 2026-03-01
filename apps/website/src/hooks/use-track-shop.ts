import { useMutation } from '@tanstack/react-query';
import type { TrackShopInput } from '@/lib/shops-api';
import { trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

export const useTrackShop = () => {
    return useMutation({
        mutationFn: async (params: TrackShopInput) => {
            try {
                return await trpcClient.app.shops.track.mutate(params);
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
    });
};

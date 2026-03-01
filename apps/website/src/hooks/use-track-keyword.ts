import { useMutation } from '@tanstack/react-query';
import type { TrackKeywordInput } from '@/lib/keywords-api';
import { trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

export const useTrackKeyword = () => {
    return useMutation({
        mutationFn: async (params: TrackKeywordInput) => {
            try {
                return await trpcClient.app.keywords.track.mutate(params);
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
    });
};

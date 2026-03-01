import { useMutation } from '@tanstack/react-query';
import type { RefreshTrackedKeywordInput } from '@/lib/keywords-api';
import { trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

export const useRefreshTrackedKeyword = () => {
    return useMutation({
        mutationFn: async (params: RefreshTrackedKeywordInput) => {
            try {
                return await trpcClient.app.keywords.refresh.mutate(params);
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
    });
};

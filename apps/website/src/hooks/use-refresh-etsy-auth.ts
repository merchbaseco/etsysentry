import { useMutation } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

export const useRefreshEtsyAuth = () => {
    return useMutation({
        mutationFn: async () => {
            try {
                return await trpcClient.app.etsyAuth.refresh.mutate({});
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
    });
};

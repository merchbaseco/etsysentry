import { useMutation } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

export const useStartEtsyAuth = () => {
    return useMutation({
        mutationFn: async () => {
            try {
                return await trpcClient.app.etsyAuth.start.mutate({});
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
    });
};

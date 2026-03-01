import { useMutation } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

export const useDisconnectEtsyAuth = () => {
    return useMutation({
        mutationFn: async () => {
            try {
                return await trpcClient.app.etsyAuth.disconnect.mutate({});
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
    });
};

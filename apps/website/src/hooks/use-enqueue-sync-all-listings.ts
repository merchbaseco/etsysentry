import { useMutation } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

export const useEnqueueSyncAllListings = () => {
    return useMutation({
        mutationFn: async () => {
            try {
                return await trpcClient.app.admin.enqueueSyncAllListings.mutate({});
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
    });
};

import { useQuery } from '@tanstack/react-query';
import { trpc, trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

interface UseAdminStatusOptions {
    enabled?: boolean;
    refetchInterval?: number;
}

export const useAdminStatus = (options: UseAdminStatusOptions = {}) => {
    return useQuery({
        ...trpc.app.admin.status.queryOptions({}),
        enabled: options.enabled,
        gcTime: Number.POSITIVE_INFINITY,
        queryFn: async () => {
            try {
                return await trpcClient.app.admin.status.query({});
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
        refetchInterval: options.refetchInterval,
        staleTime: Number.POSITIVE_INFINITY,
    });
};

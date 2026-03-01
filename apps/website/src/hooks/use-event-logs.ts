import { useInfiniteQuery } from '@tanstack/react-query';
import type { EventLogCursor, ListEventLogsInput } from '@/lib/logs-api';
import { trpc, trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

interface UseEventLogsInput {
    levels?: ListEventLogsInput['levels'];
    limit: NonNullable<ListEventLogsInput['limit']>;
    primitiveTypes?: ListEventLogsInput['primitiveTypes'];
    search?: ListEventLogsInput['search'];
    statuses?: ListEventLogsInput['statuses'];
}

interface UseEventLogsOptions {
    enabled?: boolean;
    refetchInterval?: number;
}

export const useEventLogs = (input: UseEventLogsInput, options: UseEventLogsOptions = {}) => {
    const baseParams = {
        levels: input.levels,
        limit: input.limit,
        primitiveTypes: input.primitiveTypes,
        search: input.search,
        statuses: input.statuses,
    } satisfies Omit<ListEventLogsInput, 'cursor'>;

    const queryKey = trpc.app.logs.list.queryOptions(baseParams).queryKey;

    return useInfiniteQuery({
        enabled: options.enabled,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        initialPageParam: null as EventLogCursor | null,
        queryFn: async ({ pageParam }) => {
            try {
                return await trpcClient.app.logs.list.query({
                    ...baseParams,
                    cursor: pageParam ?? undefined,
                });
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
        queryKey,
        refetchInterval: options.refetchInterval,
    });
};

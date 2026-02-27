import type { RealtimeInvalidationQuery } from '@/lib/realtime-message-types';
import { queryClient, trpc } from '@/lib/trpc-client';

const logsInvalidatedEventName = 'etsysentry:logs-invalidated';
const listingsInvalidatedEventName = 'etsysentry:listings-invalidated';
const queryKeyByInvalidationQuery: Record<
    Exclude<RealtimeInvalidationQuery, 'app.shops.list' | 'app.logs.list' | 'app.listings.list'>,
    readonly unknown[]
> = {
    'app.keywords.list': trpc.app.keywords.list.queryOptions({}).queryKey,
};
const listingsListQueryKey = trpc.app.listings.list.queryOptions({}).queryKey;
const dashboardSummaryQueryKey = trpc.app.dashboard.getSummary.queryOptions({}).queryKey;
const realtimeInvalidationFlushMs = 200;

const isLogsListQuery = (query: { queryKey: readonly unknown[] }): boolean => {
    const serializedKey = JSON.stringify(query.queryKey);

    return (
        serializedKey.includes('"app"') &&
        serializedKey.includes('"logs"') &&
        serializedKey.includes('"list"')
    );
};

const isShopsListQuery = (query: { queryKey: readonly unknown[] }): boolean => {
    const serializedKey = JSON.stringify(query.queryKey);

    return (
        serializedKey.includes('"app"') &&
        serializedKey.includes('"shops"') &&
        serializedKey.includes('"list"')
    );
};

const refetchInvalidatedQueries = async (queries: RealtimeInvalidationQuery[]): Promise<void> => {
    const uniqueQueries = Array.from(new Set(queries));
    const shouldInvalidateDashboardSummary = uniqueQueries.some((queryName) => {
        return (
            queryName === 'app.keywords.list' ||
            queryName === 'app.listings.list' ||
            queryName === 'app.shops.list'
        );
    });

    await Promise.all(
        uniqueQueries.map(async (queryName) => {
            if (queryName === 'app.logs.list') {
                await queryClient.invalidateQueries({
                    predicate: isLogsListQuery,
                });
                window.dispatchEvent(new CustomEvent(logsInvalidatedEventName));
                return;
            }

            if (queryName === 'app.listings.list') {
                await queryClient.invalidateQueries({
                    queryKey: listingsListQueryKey,
                });
                window.dispatchEvent(new CustomEvent(listingsInvalidatedEventName));
                return;
            }

            if (queryName === 'app.shops.list') {
                await queryClient.invalidateQueries({
                    predicate: isShopsListQuery,
                });
                await queryClient.refetchQueries({
                    predicate: isShopsListQuery,
                    type: 'all',
                });
                return;
            }

            const queryKey = queryKeyByInvalidationQuery[queryName];
            await queryClient.invalidateQueries({
                queryKey,
            });
            await queryClient.refetchQueries({
                queryKey,
                type: 'all',
            });
        })
    );

    if (!shouldInvalidateDashboardSummary) {
        return;
    }

    await queryClient.invalidateQueries({
        queryKey: dashboardSummaryQueryKey,
    });
};

export const createQueryInvalidateEventHandler = (): {
    handleQueryInvalidateEvent: (queries: RealtimeInvalidationQuery[]) => void;
    cleanup: () => void;
} => {
    let flushTimeoutId: number | null = null;
    const queuedQueries = new Set<RealtimeInvalidationQuery>();

    const flush = () => {
        if (queuedQueries.size === 0) {
            flushTimeoutId = null;
            return;
        }

        const queued = [...queuedQueries];
        queuedQueries.clear();
        flushTimeoutId = null;
        refetchInvalidatedQueries(queued);
    };

    const handleQueryInvalidateEvent = (queries: RealtimeInvalidationQuery[]) => {
        for (const query of queries) {
            queuedQueries.add(query);
        }

        if (flushTimeoutId !== null) {
            return;
        }

        flushTimeoutId = window.setTimeout(flush, realtimeInvalidationFlushMs);
    };

    const cleanup = () => {
        if (flushTimeoutId !== null) {
            window.clearTimeout(flushTimeoutId);
            flushTimeoutId = null;
        }

        queuedQueries.clear();
    };

    return {
        handleQueryInvalidateEvent,
        cleanup,
    };
};

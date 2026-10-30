import { QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import type { RootRouter } from '../../../server/src/api/root';

const getApiBaseUrl = (): string => '/api';

const DEFAULT_QUERY_STALE_TIME_MS = 30_000;
const DEFAULT_QUERY_GC_TIME_MS = 10 * 60_000;

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: DEFAULT_QUERY_STALE_TIME_MS,
            gcTime: DEFAULT_QUERY_GC_TIME_MS,
            refetchOnWindowFocus: false,
        },
    },
});

export const trpcClient = createTRPCClient<RootRouter>({
    links: [
        httpBatchLink({
            fetch: (input, init) =>
                fetch(input, {
                    ...init,
                    credentials: 'same-origin',
                    redirect: 'manual',
                }),
            url: getApiBaseUrl(),
        }),
    ],
});

export const trpc = createTRPCOptionsProxy<RootRouter>({
    client: trpcClient,
    queryClient,
});

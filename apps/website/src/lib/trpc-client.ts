import { QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import type { RootRouter } from '../../../server/src/api/root';

type TrpcAuthTokenGetter = () => Promise<string | null>;
const TRAILING_SLASHES_REGEX = /\/+$/;

let getAuthToken: TrpcAuthTokenGetter | null = null;

export const configureTrpcAuthTokenGetter = (tokenGetter: TrpcAuthTokenGetter | null): void => {
    getAuthToken = tokenGetter;
};

const getApiBaseUrl = (): string => {
    const configuredOrigin = (import.meta.env.VITE_SERVER_ORIGIN as string | undefined)?.trim();

    if (!configuredOrigin) {
        return '/api';
    }

    return `${configuredOrigin.replace(TRAILING_SLASHES_REGEX, '')}/api`;
};

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
            async headers() {
                const token = await getAuthToken?.();

                if (!token) {
                    return {};
                }

                return {
                    Authorization: `Bearer ${token}`,
                };
            },
            url: getApiBaseUrl(),
        }),
    ],
});

export const trpc = createTRPCOptionsProxy<RootRouter>({
    client: trpcClient,
    queryClient,
});

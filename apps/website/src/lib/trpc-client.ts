import { QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import type { RootRouter } from '../../../server/src/api/root';

type TrpcAuthTokenGetter = () => Promise<string | null>;

let getAuthToken: TrpcAuthTokenGetter | null = null;

export const configureTrpcAuthTokenGetter = (tokenGetter: TrpcAuthTokenGetter | null): void => {
    getAuthToken = tokenGetter;
};

const getApiBaseUrl = (): string => {
    const configuredOrigin = (import.meta.env.VITE_SERVER_ORIGIN as string | undefined)?.trim();

    if (!configuredOrigin) {
        return '/api';
    }

    return `${configuredOrigin.replace(/\/+$/, '')}/api`;
};

export const queryClient = new QueryClient();

export const trpcClient = createTRPCClient<RootRouter>({
    links: [
        httpBatchLink({
            async headers() {
                const token = await getAuthToken?.();

                if (!token) {
                    return {};
                }

                return {
                    Authorization: `Bearer ${token}`
                };
            },
            url: getApiBaseUrl()
        })
    ]
});

export const trpc = createTRPCOptionsProxy<RootRouter>({
    client: trpcClient,
    queryClient
});

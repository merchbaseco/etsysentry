import { QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';

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

// TODO: Replace `any` with a shared app router type once app router types are exported for website use.
const trpcClient = createTRPCClient<any>({
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

export const trpc = createTRPCOptionsProxy<any>({
    client: trpcClient,
    queryClient
});

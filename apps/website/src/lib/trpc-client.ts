import { QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';

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
            url: getApiBaseUrl()
        })
    ]
});

export const trpc = createTRPCOptionsProxy<any>({
    client: trpcClient,
    queryClient
});

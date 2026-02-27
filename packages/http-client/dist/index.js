import { QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink, httpLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
const TRAILING_SLASHES_REGEX = /\/+$/;
export const DEFAULT_API_BASE_URL = 'http://localhost:8080';
const normalizeBaseUrl = (baseUrl) => {
    return baseUrl.trim().replace(TRAILING_SLASHES_REGEX, '');
};
const toApiUrl = (baseUrl) => {
    return `${normalizeBaseUrl(baseUrl)}/api`;
};
const createRequestHeaders = (params) => {
    const trimmedApiKey = params.apiKey?.trim();
    return {
        ...(trimmedApiKey ? { 'x-api-key': trimmedApiKey } : {}),
        ...(params.headers ?? {}),
    };
};
export const createEtsySentryClient = (options) => {
    const queryClient = new QueryClient();
    const url = toApiUrl(options.baseUrl ?? DEFAULT_API_BASE_URL);
    const linkFactory = options.batch ? httpBatchLink : httpLink;
    const trpcClient = createTRPCClient({
        links: [
            linkFactory({
                headers: () => createRequestHeaders(options),
                url,
            }),
        ],
    });
    const trpc = createTRPCOptionsProxy({
        client: trpcClient,
        queryClient,
    });
    return {
        queryClient,
        trpc,
        trpcClient,
    };
};

import { QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink, httpLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
const TRAILING_SLASHES_REGEX = /\/+$/;
const BASE64URL_TO_BASE64_REGEX = /-/gu;
const BASE64URL_UNDERSCORE_REGEX = /_/gu;
const BASE64_PLUS_REGEX = /\+/gu;
const BASE64_SLASH_REGEX = /\//gu;
const BASE64_PADDING_REGEX = /=+$/u;
export const DEFAULT_API_BASE_URL = 'https://etsysentry-api.merchbase.co';
const normalizeBaseUrl = (baseUrl) => {
    return baseUrl.trim().replace(TRAILING_SLASHES_REGEX, '');
};
const toApiUrl = (baseUrl) => {
    return `${normalizeBaseUrl(baseUrl)}/api`;
};
export const createRequestHeaders = (params) => {
    const trimmedApiKey = params.apiKey?.trim();
    const trimmedAccessToken = params.accessToken?.trim();
    if (trimmedApiKey && trimmedAccessToken) {
        throw new TypeError('Provide either an API key or an OAuth access token, not both.');
    }
    if (trimmedApiKey) {
        const { clientId, clientSecret } = parseMachineCredential(trimmedApiKey);
        return {
            ...(params.headers ?? {}),
            'CF-Access-Client-Id': clientId,
            'CF-Access-Client-Secret': clientSecret,
        };
    }
    return {
        ...(params.headers ?? {}),
        ...(trimmedAccessToken ? { Authorization: `Bearer ${trimmedAccessToken}` } : {}),
    };
};
const MACHINE_CREDENTIAL_PREFIX = 'mbk_v1.';
const MACHINE_CREDENTIAL_MAX_LENGTH = 2048;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const MACHINE_CREDENTIAL_SHAPE = {
    clientId: /^[A-Za-z0-9._-]{1,256}$/u,
    clientSecret: /^[A-Za-z0-9_-]{32,512}$/u,
};
const parseMachineCredential = (value) => {
    try {
        if (!value.startsWith(MACHINE_CREDENTIAL_PREFIX) ||
            value.length > MACHINE_CREDENTIAL_MAX_LENGTH) {
            throw new Error('Invalid machine credential.');
        }
        const encoded = value.slice(MACHINE_CREDENTIAL_PREFIX.length);
        if (!BASE64URL.test(encoded)) {
            throw new Error('Invalid machine credential.');
        }
        const json = atob(encoded.replace(BASE64URL_TO_BASE64_REGEX, '+').replace(BASE64URL_UNDERSCORE_REGEX, '/'));
        const canonical = btoa(json)
            .replace(BASE64_PLUS_REGEX, '-')
            .replace(BASE64_SLASH_REGEX, '_')
            .replace(BASE64_PADDING_REGEX, '');
        if (canonical !== encoded) {
            throw new Error('Invalid machine credential.');
        }
        const parsed = JSON.parse(json);
        if (parsed === null ||
            typeof parsed !== 'object' ||
            Array.isArray(parsed) ||
            Object.keys(parsed).length !== 2 ||
            !('clientId' in parsed) ||
            !('clientSecret' in parsed) ||
            typeof parsed.clientId !== 'string' ||
            typeof parsed.clientSecret !== 'string' ||
            !MACHINE_CREDENTIAL_SHAPE.clientId.test(parsed.clientId) ||
            !MACHINE_CREDENTIAL_SHAPE.clientSecret.test(parsed.clientSecret)) {
            throw new Error('Invalid machine credential.');
        }
        return {
            clientId: parsed.clientId,
            clientSecret: parsed.clientSecret,
        };
    }
    catch {
        throw new TypeError('Invalid Merchbase API key.');
    }
};
export const createEtsySentryClient = (options) => {
    const queryClient = new QueryClient();
    const url = toApiUrl(options.baseUrl ?? DEFAULT_API_BASE_URL);
    const linkFactory = options.batch ? httpBatchLink : httpLink;
    const untypedTrpcClient = createTRPCClient({
        links: [
            linkFactory({
                fetch: (input, init) => fetch(input, {
                    ...init,
                    credentials: 'omit',
                    redirect: 'manual',
                }),
                headers: () => createRequestHeaders(options),
                url,
            }),
        ],
    });
    const trpcClient = untypedTrpcClient;
    const trpc = createTRPCOptionsProxy({
        client: untypedTrpcClient,
        queryClient,
    });
    return {
        queryClient,
        trpc,
        trpcClient,
    };
};

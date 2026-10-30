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

export interface KeywordItem {
    accountId: string;
    id: string;
    keyword: string;
    lastRefreshError: string | null;
    lastRefreshedAt: string;
    nextSyncAt: string;
    normalizedKeyword: string;
    syncState: 'idle' | 'queued' | 'syncing';
    trackingState: 'active' | 'paused' | 'error';
    updatedAt: string;
}

export interface ListingItem {
    accountId: string;
    endingTimestamp: number | null;
    etsyListingId: string;
    etsyState: 'active' | 'inactive' | 'sold_out' | 'draft' | 'expired';
    id: string;
    isDigital: boolean;
    lastRefreshError: string | null;
    lastRefreshedAt: string;
    numFavorers: number | null;
    price: {
        amount: number;
        currencyCode: string;
        divisor: number;
        value: number;
    } | null;
    priceUsdValue: number | null;
    quantity: number | null;
    shopId: string | null;
    shopName: string | null;
    shouldAutoRenew: boolean | null;
    syncState: 'idle' | 'queued' | 'syncing';
    thumbnailUrl: string | null;
    title: string;
    trackingState: 'active' | 'paused' | 'error' | 'fatal';
    updatedAt: string;
    updatedTimestamp: number | null;
    url: string | null;
    views: number | null;
}

export interface ShopItem {
    accountId: string;
    etsyShopId: string;
    id: string;
    lastRefreshError: string | null;
    lastRefreshedAt: string;
    lastSyncedListingUpdatedTimestamp: number | null;
    latestSnapshot: {
        activeListingCount: number;
        favoritesDelta: number | null;
        favoritesTotal: number | null;
        newListingCount: number;
        observedAt: string;
        reviewDelta: number | null;
        reviewTotal: number | null;
        soldDelta: number | null;
        soldTotal: number | null;
    } | null;
    nextSyncAt: string;
    shopName: string;
    shopUrl: string | null;
    syncState: 'idle' | 'queued' | 'syncing';
    trackingState: 'active' | 'paused' | 'error';
    updatedAt: string;
}

export interface ListingPerformanceData {
    favorites?: {
        latest: number | null;
        points: Array<{ ts: string; value: number | null }>;
    };
    listing: {
        id: string;
        etsyListingId: string;
        title: string;
    };
    price?: {
        latest: { currencyCode: string; value: number } | null;
        points: Array<{ currencyCode: string | null; ts: string; value: number | null }>;
    };
    quantity?: {
        latest: number | null;
        points: Array<{ ts: string; value: number | null }>;
    };
    range: {
        from: string;
        label: string;
        to: string;
    };
    views?: {
        latest: number | null;
        points: Array<{ ts: string; value: number | null }>;
    };
}

type EmptyInput = Record<string, never>;

export interface PublicRouterInputs {
    keywords: {
        list: EmptyInput;
        track: { keyword: string };
    };
    listings: {
        getPerformance: {
            trackedListingId: string;
            range?: string;
            metrics?: Array<'views' | 'favorites' | 'quantity' | 'price'>;
        };
        list: EmptyInput;
        track: { listing: string };
    };
    shops: {
        list: EmptyInput;
        track: { shop: string };
    };
}

export interface PublicRouterOutputs {
    keywords: {
        list: { items: KeywordItem[] };
        track: { created: boolean; item: KeywordItem };
    };
    listings: {
        getPerformance: ListingPerformanceData;
        list: { items: ListingItem[] };
        track: { created: boolean; item: ListingItem };
    };
    shops: {
        list: { items: ShopItem[] };
        track: { created: boolean; item: ShopItem };
    };
}

interface QueryProcedure<TInput, TOutput> {
    query: (input: TInput) => Promise<TOutput>;
}

interface MutationProcedure<TInput, TOutput> {
    mutate: (input: TInput) => Promise<TOutput>;
}

interface QueryOptionsProcedure<TInput, TOutput> {
    queryOptions: (input: TInput) => {
        queryFn: (context: unknown) => Promise<TOutput>;
        queryKey: readonly unknown[];
    };
}

export interface EtsySentryTrpcClient {
    public: {
        keywords: {
            list: QueryProcedure<
                PublicRouterInputs['keywords']['list'],
                PublicRouterOutputs['keywords']['list']
            >;
            track: MutationProcedure<
                PublicRouterInputs['keywords']['track'],
                PublicRouterOutputs['keywords']['track']
            >;
        };
        listings: {
            getPerformance: QueryProcedure<
                PublicRouterInputs['listings']['getPerformance'],
                PublicRouterOutputs['listings']['getPerformance']
            >;
            list: QueryProcedure<
                PublicRouterInputs['listings']['list'],
                PublicRouterOutputs['listings']['list']
            >;
            track: MutationProcedure<
                PublicRouterInputs['listings']['track'],
                PublicRouterOutputs['listings']['track']
            >;
        };
        shops: {
            list: QueryProcedure<
                PublicRouterInputs['shops']['list'],
                PublicRouterOutputs['shops']['list']
            >;
            track: MutationProcedure<
                PublicRouterInputs['shops']['track'],
                PublicRouterOutputs['shops']['track']
            >;
        };
    };
}

export interface EtsySentryTrpcOptionsProxy {
    public: {
        keywords: {
            list: QueryOptionsProcedure<
                PublicRouterInputs['keywords']['list'],
                PublicRouterOutputs['keywords']['list']
            >;
        };
        listings: {
            getPerformance: QueryOptionsProcedure<
                PublicRouterInputs['listings']['getPerformance'],
                PublicRouterOutputs['listings']['getPerformance']
            >;
            list: QueryOptionsProcedure<
                PublicRouterInputs['listings']['list'],
                PublicRouterOutputs['listings']['list']
            >;
        };
        shops: {
            list: QueryOptionsProcedure<
                PublicRouterInputs['shops']['list'],
                PublicRouterOutputs['shops']['list']
            >;
        };
    };
}

export interface EtsySentryClientOptions {
    accessToken?: string;
    apiKey?: string;
    baseUrl?: string;
    batch?: boolean;
    headers?: Record<string, string>;
}

export interface EtsySentryClient {
    queryClient: QueryClient;
    trpc: EtsySentryTrpcOptionsProxy;
    trpcClient: EtsySentryTrpcClient;
}

const normalizeBaseUrl = (baseUrl: string): string => {
    return baseUrl.trim().replace(TRAILING_SLASHES_REGEX, '');
};

const toApiUrl = (baseUrl: string): string => {
    return `${normalizeBaseUrl(baseUrl)}/api`;
};

export const createRequestHeaders = (params: {
    accessToken?: string;
    apiKey?: string;
    headers?: Record<string, string>;
}): Record<string, string> => {
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
} as const;

const parseMachineCredential = (value: string): { clientId: string; clientSecret: string } => {
    try {
        if (
            !value.startsWith(MACHINE_CREDENTIAL_PREFIX) ||
            value.length > MACHINE_CREDENTIAL_MAX_LENGTH
        ) {
            throw new Error('Invalid machine credential.');
        }

        const encoded = value.slice(MACHINE_CREDENTIAL_PREFIX.length);
        if (!BASE64URL.test(encoded)) {
            throw new Error('Invalid machine credential.');
        }

        const json = atob(
            encoded.replace(BASE64URL_TO_BASE64_REGEX, '+').replace(BASE64URL_UNDERSCORE_REGEX, '/')
        );
        const canonical = btoa(json)
            .replace(BASE64_PLUS_REGEX, '-')
            .replace(BASE64_SLASH_REGEX, '_')
            .replace(BASE64_PADDING_REGEX, '');
        if (canonical !== encoded) {
            throw new Error('Invalid machine credential.');
        }

        const parsed: unknown = JSON.parse(json);
        if (
            parsed === null ||
            typeof parsed !== 'object' ||
            Array.isArray(parsed) ||
            Object.keys(parsed).length !== 2 ||
            !('clientId' in parsed) ||
            !('clientSecret' in parsed) ||
            typeof parsed.clientId !== 'string' ||
            typeof parsed.clientSecret !== 'string' ||
            !MACHINE_CREDENTIAL_SHAPE.clientId.test(parsed.clientId) ||
            !MACHINE_CREDENTIAL_SHAPE.clientSecret.test(parsed.clientSecret)
        ) {
            throw new Error('Invalid machine credential.');
        }

        return {
            clientId: parsed.clientId,
            clientSecret: parsed.clientSecret,
        };
    } catch {
        throw new TypeError('Invalid Merchbase API key.');
    }
};

export const createEtsySentryClient = (options: EtsySentryClientOptions): EtsySentryClient => {
    const queryClient = new QueryClient();
    const url = toApiUrl(options.baseUrl ?? DEFAULT_API_BASE_URL);
    const linkFactory = options.batch ? httpBatchLink : httpLink;

    const untypedTrpcClient = createTRPCClient({
        links: [
            linkFactory({
                fetch: (input, init) =>
                    fetch(input, {
                        ...init,
                        credentials: 'omit',
                        redirect: 'manual',
                    }),
                headers: () => createRequestHeaders(options),
                url,
            }),
        ],
    });
    const trpcClient = untypedTrpcClient as unknown as EtsySentryTrpcClient;

    const trpc = createTRPCOptionsProxy({
        client: untypedTrpcClient,
        queryClient,
    }) as unknown as EtsySentryTrpcOptionsProxy;

    return {
        queryClient,
        trpc,
        trpcClient,
    };
};

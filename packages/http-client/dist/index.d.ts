import { QueryClient } from '@tanstack/react-query';
export declare const DEFAULT_API_BASE_URL = "http://localhost:8080";
export interface KeywordItem {
    accountId: string;
    id: string;
    keyword: string;
    lastRefreshError: string | null;
    lastRefreshedAt: string;
    nextSyncAt: string;
    normalizedKeyword: string;
    syncState: 'idle' | 'queued' | 'syncing';
    trackerClerkUserId: string;
    trackingState: 'active' | 'paused' | 'error';
    updatedAt: string;
}
export interface ListingItem {
    accountId: string;
    etsyListingId: string;
    etsyState: 'active' | 'inactive' | 'sold_out' | 'draft' | 'expired';
    id: string;
    isDigital: boolean;
    lastRefreshError: string | null;
    lastRefreshedAt: string;
    numFavorers: number | null;
    endingTimestamp: number | null;
    price: {
        amount: number;
        currencyCode: string;
        divisor: number;
        value: number;
    } | null;
    priceUsdValue: number | null;
    quantity: number | null;
    shouldAutoRenew: boolean | null;
    shopId: string | null;
    shopName: string | null;
    syncState: 'idle' | 'queued' | 'syncing';
    thumbnailUrl: string | null;
    title: string;
    trackerClerkUserId: string;
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
        points: Array<{
            ts: string;
            value: number | null;
        }>;
    };
    listing: {
        id: string;
        etsyListingId: string;
        title: string;
    };
    price?: {
        latest: {
            currencyCode: string;
            value: number;
        } | null;
        points: Array<{
            currencyCode: string | null;
            ts: string;
            value: number | null;
        }>;
    };
    quantity?: {
        latest: number | null;
        points: Array<{
            ts: string;
            value: number | null;
        }>;
    };
    range: {
        from: string;
        label: string;
        to: string;
    };
    views?: {
        latest: number | null;
        points: Array<{
            ts: string;
            value: number | null;
        }>;
    };
}
type EmptyInput = Record<string, never>;
export interface PublicRouterInputs {
    keywords: {
        list: EmptyInput;
        track: {
            keyword: string;
        };
    };
    listings: {
        getPerformance: {
            trackedListingId: string;
            range?: string;
            metrics?: Array<'views' | 'favorites' | 'quantity' | 'price'>;
        };
        list: EmptyInput;
        track: {
            listing: string;
        };
    };
    shops: {
        list: EmptyInput;
        track: {
            shop: string;
        };
    };
}
export interface PublicRouterOutputs {
    keywords: {
        list: {
            items: KeywordItem[];
        };
        track: {
            created: boolean;
            item: KeywordItem;
        };
    };
    listings: {
        getPerformance: ListingPerformanceData;
        list: {
            items: ListingItem[];
        };
        track: {
            created: boolean;
            item: ListingItem;
        };
    };
    shops: {
        list: {
            items: ShopItem[];
        };
        track: {
            created: boolean;
            item: ShopItem;
        };
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
            list: QueryProcedure<PublicRouterInputs['keywords']['list'], PublicRouterOutputs['keywords']['list']>;
            track: MutationProcedure<PublicRouterInputs['keywords']['track'], PublicRouterOutputs['keywords']['track']>;
        };
        listings: {
            getPerformance: QueryProcedure<PublicRouterInputs['listings']['getPerformance'], PublicRouterOutputs['listings']['getPerformance']>;
            list: QueryProcedure<PublicRouterInputs['listings']['list'], PublicRouterOutputs['listings']['list']>;
            track: MutationProcedure<PublicRouterInputs['listings']['track'], PublicRouterOutputs['listings']['track']>;
        };
        shops: {
            list: QueryProcedure<PublicRouterInputs['shops']['list'], PublicRouterOutputs['shops']['list']>;
            track: MutationProcedure<PublicRouterInputs['shops']['track'], PublicRouterOutputs['shops']['track']>;
        };
    };
}
export interface EtsySentryTrpcOptionsProxy {
    public: {
        keywords: {
            list: QueryOptionsProcedure<PublicRouterInputs['keywords']['list'], PublicRouterOutputs['keywords']['list']>;
        };
        listings: {
            getPerformance: QueryOptionsProcedure<PublicRouterInputs['listings']['getPerformance'], PublicRouterOutputs['listings']['getPerformance']>;
            list: QueryOptionsProcedure<PublicRouterInputs['listings']['list'], PublicRouterOutputs['listings']['list']>;
        };
        shops: {
            list: QueryOptionsProcedure<PublicRouterInputs['shops']['list'], PublicRouterOutputs['shops']['list']>;
        };
    };
}
export interface EtsySentryClientOptions {
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
export declare const createEtsySentryClient: (options: EtsySentryClientOptions) => EtsySentryClient;
export {};

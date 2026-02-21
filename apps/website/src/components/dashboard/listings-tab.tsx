import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    listTrackedListings,
    refreshTrackedListing,
    trackListing,
    type TrackedListingItem
} from '@/lib/listings-api';
import { TrpcRequestError } from '@/lib/trpc-http';
import { cn } from '@/lib/utils';
import {
    EmptyState,
    FilterChip,
    StatusBadge,
    TopToolbar,
    formatNumber,
    timeAgo
} from './shared';

const OAUTH_SESSION_STORAGE_KEY = 'etsysentry.oauthSessionId';
const DEFAULT_TENANT_ID =
    (import.meta.env.VITE_DEFAULT_TENANT_ID as string | undefined) ?? 'tenant-local-dev';
const DEFAULT_CLERK_USER_ID =
    (import.meta.env.VITE_DEFAULT_CLERK_USER_ID as string | undefined) ?? 'user-local-dev';

const getOauthSessionId = (): string | null => {
    try {
        return window.localStorage.getItem(OAUTH_SESSION_STORAGE_KEY);
    } catch {
        return null;
    }
};

const formatPrice = (item: TrackedListingItem): string => {
    if (!item.price) {
        return '--';
    }

    return `${item.price.currencyCode} ${(item.price.value || 0).toFixed(2)}`;
};

const toErrorMessage = (error: unknown): string => {
    if (error instanceof TrpcRequestError) {
        return error.message;
    }

    if (error instanceof Error && error.message.length > 0) {
        return error.message;
    }

    return 'Unexpected request failure.';
};

const upsertById = (items: TrackedListingItem[], nextItem: TrackedListingItem): TrackedListingItem[] => {
    const existingIndex = items.findIndex((item) => item.id === nextItem.id);

    if (existingIndex === -1) {
        return [nextItem, ...items];
    }

    const clone = [...items];
    clone[existingIndex] = nextItem;

    return clone;
};

export function ListingsTab() {
    const [search, setSearch] = useState('');
    const [trackingStateFilter, setTrackingStateFilter] = useState<
        'active' | 'paused' | 'error' | null
    >(null);
    const [etsyStateFilter, setEtsyStateFilter] = useState<
        'active' | 'inactive' | 'sold_out' | 'draft' | 'expired' | null
    >(null);
    const [items, setItems] = useState<TrackedListingItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTracking, setIsTracking] = useState(false);
    const [refreshingById, setRefreshingById] = useState<Record<string, boolean>>({});
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [listingInput, setListingInput] = useState('');

    const loadListings = useCallback(async () => {
        setIsLoading(true);

        try {
            const response = await listTrackedListings({
                tenantId: DEFAULT_TENANT_ID
            });

            setItems(response.items);
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadListings();
    }, [loadListings]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();

        return items.filter((item) => {
            if (trackingStateFilter && item.trackingState !== trackingStateFilter) {
                return false;
            }

            if (etsyStateFilter && item.etsyState !== etsyStateFilter) {
                return false;
            }

            if (query.length === 0) {
                return true;
            }

            return (
                item.title.toLowerCase().includes(query) ||
                item.etsyListingId.includes(query) ||
                (item.shopId ?? '').includes(query)
            );
        });
    }, [etsyStateFilter, items, search, trackingStateFilter]);

    const handleTrack = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!listingInput.trim()) {
            return;
        }

        const oauthSessionId = getOauthSessionId();

        if (!oauthSessionId) {
            setErrorMessage('Connect Etsy API first before tracking a listing.');
            return;
        }

        setIsTracking(true);

        try {
            const response = await trackListing({
                listing: listingInput,
                oauthSessionId,
                tenantId: DEFAULT_TENANT_ID,
                trackerClerkUserId: DEFAULT_CLERK_USER_ID
            });

            setItems((current) => upsertById(current, response.item));
            setListingInput('');
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toErrorMessage(error));
        } finally {
            setIsTracking(false);
        }
    };

    const handleRefreshRow = async (item: TrackedListingItem) => {
        const oauthSessionId = getOauthSessionId();

        if (!oauthSessionId) {
            setErrorMessage('Connect Etsy API first before refreshing a listing.');
            return;
        }

        setRefreshingById((current) => ({
            ...current,
            [item.id]: true
        }));

        try {
            const refreshed = await refreshTrackedListing({
                oauthSessionId,
                tenantId: DEFAULT_TENANT_ID,
                trackedListingId: item.id,
                trackerClerkUserId: DEFAULT_CLERK_USER_ID
            });

            setItems((current) => upsertById(current, refreshed));
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toErrorMessage(error));
            void loadListings();
        } finally {
            setRefreshingById((current) => ({
                ...current,
                [item.id]: false
            }));
        }
    };

    return (
        <div className="flex h-full flex-col">
            <TopToolbar search={search} onSearchChange={setSearch} onRefresh={() => void loadListings()}>
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[9px] uppercase tracking-widest text-terminal-dim">
                        Tracking
                    </span>
                    {(['active', 'paused', 'error'] as const).map((stateValue) => (
                        <FilterChip
                            key={stateValue}
                            label={stateValue}
                            active={trackingStateFilter === stateValue}
                            onClick={() =>
                                setTrackingStateFilter(
                                    trackingStateFilter === stateValue ? null : stateValue
                                )
                            }
                        />
                    ))}
                    <span className="mx-1 text-border">|</span>
                    <span className="mr-1 text-[9px] uppercase tracking-widest text-terminal-dim">Etsy</span>
                    {(['active', 'inactive', 'sold_out', 'draft', 'expired'] as const).map(
                        (stateValue) => (
                            <FilterChip
                                key={stateValue}
                                label={stateValue}
                                active={etsyStateFilter === stateValue}
                                onClick={() =>
                                    setEtsyStateFilter(etsyStateFilter === stateValue ? null : stateValue)
                                }
                            />
                        )
                    )}
                </div>
            </TopToolbar>

            <form
                onSubmit={handleTrack}
                className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs"
            >
                <input
                    value={listingInput}
                    onChange={(event) => setListingInput(event.target.value)}
                    type="text"
                    placeholder="Paste Etsy listing URL (or listing id)"
                    className="h-8 flex-1 rounded border border-border bg-secondary px-2 text-xs outline-none placeholder:text-muted-foreground"
                />
                <button
                    type="submit"
                    disabled={isTracking}
                    className={cn(
                        'h-8 rounded border border-border bg-secondary px-3 text-[11px] uppercase tracking-wider transition-colors',
                        'disabled:cursor-default disabled:opacity-50',
                        'hover:text-foreground'
                    )}
                >
                    {isTracking ? 'Tracking...' : 'Track Listing'}
                </button>
            </form>

            {errorMessage ? (
                <div className="border-b border-terminal-red/20 bg-terminal-red/10 px-3 py-2 text-xs text-terminal-red">
                    {errorMessage}
                </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-auto">
                {isLoading ? (
                    <div className="px-3 py-6 text-xs text-muted-foreground">Loading tracked listings...</div>
                ) : filtered.length === 0 ? (
                    <EmptyState message="No tracked listings yet. Add one with an Etsy URL above." />
                ) : (
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 z-10 bg-card">
                            <tr className="border-b border-border">
                                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Title
                                </th>
                                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Listing ID
                                </th>
                                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Shop
                                </th>
                                <th className="px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Price
                                </th>
                                <th className="px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Views
                                </th>
                                <th className="px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Favs
                                </th>
                                <th className="px-2 py-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Qty
                                </th>
                                <th className="px-2 py-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Etsy
                                </th>
                                <th className="px-2 py-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Tracking
                                </th>
                                <th className="px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Refreshed
                                </th>
                                <th className="px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((item) => {
                                const isRefreshing = refreshingById[item.id] === true;

                                return (
                                    <tr key={item.id} className="border-b border-border/50">
                                        <td className="max-w-56 px-3 py-1.5 text-foreground">
                                            <a
                                                href={item.url ?? undefined}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="line-clamp-2 hover:text-primary"
                                            >
                                                {item.title}
                                            </a>
                                        </td>
                                        <td className="px-2 py-1.5 font-mono text-terminal-dim">
                                            {item.etsyListingId}
                                        </td>
                                        <td className="px-2 py-1.5">{item.shopId ?? '--'}</td>
                                        <td className="px-2 py-1.5 text-right text-terminal-green">
                                            {formatPrice(item)}
                                        </td>
                                        <td className="px-2 py-1.5 text-right text-terminal-dim">
                                            {item.views === null ? '--' : formatNumber(item.views)}
                                        </td>
                                        <td className="px-2 py-1.5 text-right text-terminal-dim">
                                            {item.numFavorers === null
                                                ? '--'
                                                : formatNumber(item.numFavorers)}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            {item.quantity === null ? '--' : item.quantity}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            <span
                                                className={cn(
                                                    'rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider',
                                                    item.etsyState === 'active' &&
                                                        'bg-terminal-green/10 text-terminal-green',
                                                    item.etsyState === 'inactive' &&
                                                        'bg-secondary text-terminal-dim',
                                                    item.etsyState === 'sold_out' &&
                                                        'bg-terminal-yellow/10 text-terminal-yellow',
                                                    item.etsyState === 'draft' &&
                                                        'bg-terminal-blue/10 text-terminal-blue',
                                                    item.etsyState === 'expired' &&
                                                        'bg-terminal-red/10 text-terminal-red'
                                                )}
                                            >
                                                {item.etsyState}
                                            </span>
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            <StatusBadge status={item.trackingState} />
                                        </td>
                                        <td className="px-2 py-1.5 text-right text-[10px] text-terminal-dim">
                                            {timeAgo(item.lastRefreshedAt)}
                                        </td>
                                        <td className="px-2 py-1.5 text-right">
                                            <button
                                                type="button"
                                                onClick={() => void handleRefreshRow(item)}
                                                disabled={isRefreshing}
                                                className={cn(
                                                    'rounded border border-border bg-secondary px-2 py-1 text-[10px] uppercase tracking-wider',
                                                    'disabled:cursor-default disabled:opacity-50',
                                                    'hover:text-foreground'
                                                )}
                                            >
                                                {isRefreshing ? 'Refreshing' : 'Refresh'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

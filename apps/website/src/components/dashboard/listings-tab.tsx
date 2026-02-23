import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
    listTrackedListings,
    refreshTrackedListing,
    trackListing,
    type TrackedListingItem
} from '@/lib/listings-api';
import { Button } from '@/components/ui/button';
import { TrpcRequestError } from '@/lib/trpc-http';
import { cn } from '@/lib/utils';
import {
    EmptyState,
    FilterChip,
    TopToolbar,
    formatNumber,
    timeAgo
} from './shared';

const formatPrice = (item: TrackedListingItem): string => {
    if (!item.price) {
        return '--';
    }

    const value = (item.price.value || 0).toFixed(2);

    if (item.price.currencyCode === 'USD') {
        return `$${value}`;
    }

    return `${item.price.currencyCode} ${value}`;
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
            const response = await listTrackedListings({});

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
                (item.shopName ?? '').toLowerCase().includes(query) ||
                (item.shopId ?? '').includes(query)
            );
        });
    }, [etsyStateFilter, items, search, trackingStateFilter]);

    const handleTrack = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!listingInput.trim()) {
            return;
        }

        setIsTracking(true);

        try {
            const response = await trackListing({
                listing: listingInput
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
        setRefreshingById((current) => ({
            ...current,
            [item.id]: true
        }));

        try {
            const refreshed = await refreshTrackedListing({
                trackedListingId: item.id
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
                    <table className="w-full table-fixed text-xs">
                        <thead className="sticky top-0 z-10 bg-card">
                            <tr className="border-b border-border">
                                <th className="w-[68px] pl-2 pr-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground" />
                                <th className="pl-2 pr-2 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Title
                                </th>
                                <th className="w-[100px] px-2 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Shop
                                </th>
                                <th className="w-[90px] px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Price
                                </th>
                                <th className="w-[80px] px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Views
                                </th>
                                <th className="w-[70px] px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Favs
                                </th>
                                <th className="w-[50px] px-2 py-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Qty
                                </th>
                                <th className="w-[110px] px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Refreshed
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((item) => {
                                const isRefreshing = refreshingById[item.id] === true;

                                return (
                                    <tr key={item.id} className="border-b border-border/50">
                                        <td className="w-[68px] pl-2 pr-3 py-1.5">
                                            <div className="size-12 overflow-hidden rounded bg-secondary">
                                                {item.thumbnailUrl ? (
                                                    <img
                                                        src={item.thumbnailUrl}
                                                        alt=""
                                                        className="size-full max-w-none origin-center scale-[1.2] object-cover"
                                                    />
                                                ) : null}
                                            </div>
                                        </td>
                                        <td className="pl-2 pr-2 py-1.5 text-foreground">
                                            <a
                                                href={item.url ?? undefined}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block truncate hover:text-primary"
                                            >
                                                {item.title}
                                            </a>
                                        </td>
                                        <td className="truncate px-2 py-1.5">
                                            {item.shopName ?? '--'}
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-1.5 text-right text-terminal-green">
                                            {formatPrice(item)}
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-1.5 text-right text-terminal-dim">
                                            {item.views === null ? '--' : formatNumber(item.views)}
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-1.5 text-right text-terminal-dim">
                                            {item.numFavorers === null
                                                ? '--'
                                                : formatNumber(item.numFavorers)}
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-1.5 text-center">
                                            {item.quantity === null ? '--' : item.quantity}
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <div className="flex items-center justify-end gap-1">
                                                <span className="text-[10px] text-terminal-dim">
                                                    {timeAgo(item.lastRefreshedAt)}
                                                </span>
                                                <Button
                                                    type="button"
                                                    variant="transparent"
                                                    size="icon-sm"
                                                    onClick={() => void handleRefreshRow(item)}
                                                    disabled={isRefreshing}
                                                    aria-label={
                                                        isRefreshing
                                                            ? `Refreshing ${item.title}`
                                                            : `Refresh ${item.title}`
                                                    }
                                                    title={
                                                        isRefreshing
                                                            ? 'Refreshing listing'
                                                            : 'Refresh listing'
                                                    }
                                                    className="size-6 text-terminal-dim hover:text-foreground"
                                                >
                                                    <RefreshCw
                                                        className={cn(
                                                            'size-3.5',
                                                            isRefreshing && 'animate-spin'
                                                        )}
                                                    />
                                                </Button>
                                            </div>
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

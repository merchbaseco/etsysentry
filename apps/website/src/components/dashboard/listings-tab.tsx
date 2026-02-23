import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
    type ListTrackedListingsOutput,
    listTrackedListings,
    refreshTrackedListing,
    trackListing,
    type TrackedListingItem
} from '@/lib/listings-api';
import { Button } from '@/components/ui/button';
import { TrpcRequestError } from '@/lib/trpc-http';
import { queryClient, trpc } from '@/lib/trpc-client';
import { cn } from '@/lib/utils';
import {
    EmptyState,
    FilterBar,
    FilterGroup,
    TopToolbar,
    formatNumber,
    timeAgo
} from './shared';
import { MouseThumbnailTooltip } from './mouse-thumbnail-tooltip';
import { RangeFilter } from './range-filter';

const trackedListingsQueryKey = trpc.app.listings.list.queryOptions({}).queryKey;
const trackedListingsQueryKeyJson = JSON.stringify(trackedListingsQueryKey);

const formatPrice = (item: TrackedListingItem): string => {
    if (!item.price) {
        return '--';
    }

    const nativeValue = (item.price.value || 0).toFixed(2);
    const usdValue =
        item.priceUsdValue !== null && item.priceUsdValue !== undefined
            ? item.priceUsdValue.toFixed(2)
            : null;

    if (item.price.currencyCode === 'USD' && usdValue !== null) {
        return `$${usdValue}`;
    }

    if (usdValue !== null) {
        return `$${usdValue} (${item.price.currencyCode} ${nativeValue})`;
    }

    if (item.price.currencyCode === 'USD') {
        return `$${nativeValue}`;
    }

    return `${item.price.currencyCode} ${nativeValue}`;
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
    const cachedTrackedListings = queryClient.getQueryData<ListTrackedListingsOutput>(
        trackedListingsQueryKey
    );
    const initialItems = cachedTrackedListings?.items ?? [];

    const [search, setSearch] = useState('');
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 40]);
    const [favsRange, setFavsRange] = useState<[number, number]>([0, 5000]);
    const [items, setItems] = useState<TrackedListingItem[]>(() => initialItems);
    const [isLoading, setIsLoading] = useState(() => initialItems.length === 0);
    const [isTracking, setIsTracking] = useState(false);
    const [refreshingById, setRefreshingById] = useState<Record<string, boolean>>({});
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [listingInput, setListingInput] = useState('');

    const loadListings = useCallback(async () => {
        try {
            const response = await listTrackedListings({});

            setItems(response.items);
            queryClient.setQueryData(trackedListingsQueryKey, response);
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

    useEffect(() => {
        return queryClient.getQueryCache().subscribe((event) => {
            if (JSON.stringify(event.query.queryKey) !== trackedListingsQueryKeyJson) {
                return;
            }

            const data = event.query.state.data as ListTrackedListingsOutput | undefined;

            if (!data) {
                return;
            }

            setItems(data.items);
            setIsLoading(false);
        });
    }, []);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        const priceActive = priceRange[0] > 0 || priceRange[1] < 40;
        const favsActive = favsRange[0] > 0 || favsRange[1] < 5000;

        return items.filter((item) => {
            if (priceActive) {
                const price = item.price?.value ?? null;
                if (price === null || price < priceRange[0] || price > priceRange[1]) {
                    return false;
                }
            }

            if (favsActive) {
                if (item.numFavorers === null || item.numFavorers < favsRange[0] || item.numFavorers > favsRange[1]) {
                    return false;
                }
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
    }, [favsRange, items, priceRange, search]);

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

            setItems((current) => {
                const nextItems = upsertById(current, response.item);

                queryClient.setQueryData<ListTrackedListingsOutput>(trackedListingsQueryKey, {
                    items: nextItems
                });

                return nextItems;
            });
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

            setItems((current) => {
                const nextItems = upsertById(current, refreshed);

                queryClient.setQueryData<ListTrackedListingsOutput>(trackedListingsQueryKey, {
                    items: nextItems
                });

                return nextItems;
            });
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
            <TopToolbar search={search} onSearchChange={setSearch}>
                <FilterBar>
                    <FilterGroup label="Price">
                        <RangeFilter
                            value={priceRange}
                            min={0}
                            max={40}
                            prefix="$"
                            onChange={setPriceRange}
                        />
                    </FilterGroup>
                    <FilterGroup label="Favs">
                        <RangeFilter
                            value={favsRange}
                            min={0}
                            max={5000}
                            step={50}
                            onChange={setFavsRange}
                        />
                    </FilterGroup>
                </FilterBar>
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
                                <th className="w-[68px] pl-3 pr-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground" />
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
                                        <td className="w-[68px] pl-3 pr-3 py-1.5">
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
                                            <div className="space-y-0.5">
                                                <MouseThumbnailTooltip
                                                    className="block min-w-0"
                                                    imageAlt={item.title}
                                                    imageUrl={item.thumbnailUrl}
                                                >
                                                    <a
                                                        href={item.url ?? undefined}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="block truncate hover:text-primary"
                                                    >
                                                        {item.title}
                                                    </a>
                                                </MouseThumbnailTooltip>
                                                <div className="truncate font-semibold text-foreground">
                                                    {item.shopName ?? '--'}
                                                </div>
                                            </div>
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
                                                <span className="text-[11px] text-terminal-dim">
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

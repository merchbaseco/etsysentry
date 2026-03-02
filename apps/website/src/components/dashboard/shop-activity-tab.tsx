import { ArrowDownUp } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { ListingHistoryDrawer } from '@/components/dashboard/listing-history-drawer';
import {
    isListingSyncInFlight,
    toListingsErrorMessage,
} from '@/components/dashboard/listings-tab-utils';
import { ListingsTable } from '@/components/dashboard/listings-table';
import { ShopActivityOverviewHeader } from '@/components/dashboard/shop-activity-overview';
import {
    shopListingsQueryKey,
    shopOverviewQueryKey,
    toShopTitle,
} from '@/components/dashboard/shop-activity-tab-utils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useRefreshTrackedListing } from '@/hooks/use-refresh-tracked-listing';
import { useShopActivityListings } from '@/hooks/use-shop-activity-listings';
import { useShopActivityOverview } from '@/hooks/use-shop-activity-overview';
import type { TrackedListingItem } from '@/lib/listings-api';
import type { ShopActivitySortOrder } from '@/lib/shops-api';
import { queryClient } from '@/lib/trpc-client';

const SORT_ORDER_OPTIONS = [
    {
        value: 'most_recently_sold',
        label: 'Most Recently Sold',
    },
    {
        value: 'most_recently_favorited',
        label: 'Most Recently Favorited',
    },
    {
        value: 'newest_listings',
        label: 'Newest Listings',
    },
] as const satisfies Array<{
    label: string;
    value: ShopActivitySortOrder;
}>;

const isTabState = (value: unknown): value is { etsyShopId?: string; shopName?: string } => {
    return typeof value === 'object' && value !== null;
};

export function ShopActivityTab() {
    const { etsyShopId } = useParams<{ etsyShopId: string }>();
    const location = useLocation();
    const locationState = isTabState(location.state) ? location.state : undefined;

    const [sortOrder, setSortOrder] = useState<ShopActivitySortOrder>('most_recently_sold');
    const [historyListing, setHistoryListing] = useState<TrackedListingItem | null>(null);
    const [refreshingById, setRefreshingById] = useState<Record<string, boolean>>({});
    const scrollViewportRef = useRef<HTMLDivElement | null>(null);
    const refreshTrackedListing = useRefreshTrackedListing();

    const normalizedShopId = etsyShopId?.trim() ?? '';
    const hasShopId = normalizedShopId.length > 0;

    const overviewQuery = useShopActivityOverview(
        {
            etsyShopId: normalizedShopId,
        },
        {
            enabled: hasShopId,
        }
    );
    const listingsQuery = useShopActivityListings(
        {
            etsyShopId: normalizedShopId,
            sortOrder,
        },
        {
            enabled: hasShopId,
        }
    );

    const items = listingsQuery.data?.items ?? [];
    const overview = overviewQuery.data?.overview ?? null;
    const isTrackedShop = overviewQuery.data?.isTrackedShop ?? null;
    const shopTitle = toShopTitle({
        etsyShopId,
        listingsShopName: listingsQuery.data?.shopName,
        locationShopName: locationState?.shopName,
        overviewShopName: overviewQuery.data?.shopName,
    });
    const tableResetKey = `${normalizedShopId}|${sortOrder}`;

    useEffect(() => {
        if (!historyListing) {
            return;
        }

        const nextHistoryListing = items.find((item) => item.id === historyListing.id) ?? null;

        if (!nextHistoryListing) {
            setHistoryListing(null);
            return;
        }

        if (nextHistoryListing !== historyListing) {
            setHistoryListing(nextHistoryListing);
        }
    }, [historyListing, items]);

    const handleRefreshRow = useCallback(
        async (item: TrackedListingItem) => {
            if (!hasShopId || isListingSyncInFlight(item) || refreshingById[item.id] === true) {
                return;
            }

            setRefreshingById((current) => ({
                ...current,
                [item.id]: true,
            }));

            try {
                await refreshTrackedListing.mutateAsync({
                    trackedListingId: item.id,
                });

                await Promise.all([
                    queryClient.invalidateQueries({
                        queryKey: shopListingsQueryKey(normalizedShopId, sortOrder),
                    }),
                    queryClient.invalidateQueries({
                        queryKey: shopOverviewQueryKey(normalizedShopId),
                    }),
                ]);
            } finally {
                setRefreshingById((current) => ({
                    ...current,
                    [item.id]: false,
                }));
            }
        },
        [hasShopId, normalizedShopId, refreshTrackedListing, refreshingById, sortOrder]
    );

    let overviewErrorMessage: string | null = null;

    if (!hasShopId) {
        overviewErrorMessage = 'Missing Etsy shop id.';
    } else if (overviewQuery.error) {
        overviewErrorMessage = toListingsErrorMessage(overviewQuery.error);
    }

    let listingsErrorMessage: string | null = null;

    if (!hasShopId) {
        listingsErrorMessage = 'Missing Etsy shop id.';
    } else if (listingsQuery.error) {
        listingsErrorMessage = toListingsErrorMessage(listingsQuery.error);
    }
    const isOverviewLoading = hasShopId && overviewQuery.isPending;
    const isListingsLoading = hasShopId && listingsQuery.isPending && !listingsQuery.data;
    const isTrackedBannerVisible = !isOverviewLoading && isTrackedShop === false;

    let listingsContent: ReactNode;
    if (isListingsLoading) {
        listingsContent = (
            <div className="px-3 py-6 text-muted-foreground text-xs">Loading shop listings...</div>
        );
    } else if (items.length === 0) {
        listingsContent = (
            <div className="px-3 py-6 text-muted-foreground text-xs">
                No listings are currently tracked for this shop.
            </div>
        );
    } else {
        listingsContent = (
            <ListingsTable
                items={items}
                onRefresh={(item) => handleRefreshRow(item)}
                onRowMouseEnter={(_event, _item) => undefined}
                onRowMouseLeave={() => undefined}
                onRowMouseMove={(_event, _item) => undefined}
                onSelectListing={(item) => setHistoryListing(item)}
                refreshingById={refreshingById}
                resetKey={tableResetKey}
                scrollContainerRef={scrollViewportRef}
            />
        );
    }

    return (
        <div className="flex h-full flex-col">
            <ShopActivityOverviewHeader
                etsyShopId={etsyShopId}
                isOverviewLoading={isOverviewLoading}
                isTrackedShop={isTrackedShop}
                overview={overview}
                shopTitle={shopTitle}
            />

            <div className="flex items-center justify-end gap-1.5 border-border border-b px-3 py-1">
                <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-terminal-dim uppercase tracking-widest">
                        Sort
                    </span>
                    <Select
                        onValueChange={(value) => setSortOrder(value as ShopActivitySortOrder)}
                        value={sortOrder}
                    >
                        <SelectTrigger
                            className="h-7 gap-1 rounded border-none bg-secondary px-1.5 py-0 text-[11px] shadow-none"
                            size="sm"
                        >
                            <ArrowDownUp className="size-3 shrink-0 text-terminal-dim" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {SORT_ORDER_OPTIONS.map((option) => (
                                <SelectItem
                                    className="text-xs"
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {isTrackedBannerVisible ? (
                <div className="border-terminal-yellow/30 border-b bg-terminal-yellow/10 px-3 py-2">
                    <p className="text-terminal-yellow text-xs">
                        This shop is not tracked. Showing tracked listings currently associated with
                        this shop only.
                    </p>
                </div>
            ) : null}

            {overviewErrorMessage ? (
                <div className="border-terminal-red/20 border-b bg-terminal-red/10 px-3 py-2 text-terminal-red text-xs">
                    {overviewErrorMessage}
                </div>
            ) : null}

            {listingsErrorMessage ? (
                <div className="border-terminal-red/20 border-b bg-terminal-red/10 px-3 py-2 text-terminal-red text-xs">
                    {listingsErrorMessage}
                </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-auto" ref={scrollViewportRef}>
                {listingsContent}
            </div>

            <ListingHistoryDrawer
                onClose={() => setHistoryListing(null)}
                selectedListing={historyListing}
            />
        </div>
    );
}

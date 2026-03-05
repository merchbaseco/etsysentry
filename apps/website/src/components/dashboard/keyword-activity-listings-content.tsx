import { RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toShopActivityPath } from '@/components/dashboard/shop-activity-tabs-state';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/components/ui/dashboard';
import type { GetKeywordActivityOutput } from '@/lib/keywords-api';
import { cn } from '@/lib/utils';

export type KeywordActivityListingRow = GetKeywordActivityOutput['items'][number];

interface KeywordActivityListingsContentProps {
    isLoading: boolean;
    onRefresh: (item: KeywordActivityListingRow['listing']) => void;
    onSelectListing: (item: KeywordActivityListingRow['listing']) => void;
    refreshingById: Record<string, boolean>;
    rows: KeywordActivityListingRow[];
}

const isListingSyncInFlight = (
    syncState: KeywordActivityListingRow['listing']['syncState']
): boolean => {
    return syncState === 'queued' || syncState === 'syncing';
};

const formatListingPrice = (listing: KeywordActivityListingRow['listing']): string => {
    if (!listing.price) {
        return '--';
    }

    const nativeValue = (listing.price.value || 0).toFixed(2);
    const usdValue =
        listing.priceUsdValue !== null && listing.priceUsdValue !== undefined
            ? listing.priceUsdValue.toFixed(2)
            : null;

    if (usdValue !== null) {
        return `$${usdValue}`;
    }

    if (listing.price.currencyCode === 'USD') {
        return `$${nativeValue}`;
    }

    return `${listing.price.currencyCode} ${nativeValue}`;
};

const TH = 'whitespace-nowrap px-2 py-2 text-[10px] text-muted-foreground uppercase tracking-wider';

const RankChange = ({ value }: { value: number | null }) => {
    if (value === null) {
        return <span className="text-muted-foreground/40">--</span>;
    }

    if (value === 0) {
        return <span className="text-muted-foreground">0</span>;
    }

    return (
        <span
            className={cn(
                'font-mono tabular-nums',
                value > 0 ? 'text-terminal-green' : 'text-terminal-red'
            )}
        >
            {value > 0 ? `+${value}` : value}
        </span>
    );
};

export const KeywordActivityListingsContent = (props: KeywordActivityListingsContentProps) => {
    const navigate = useNavigate();

    if (props.isLoading) {
        return (
            <div className="px-3 py-6 text-muted-foreground text-xs">
                Loading keyword activity...
            </div>
        );
    }

    if (props.rows.length === 0) {
        return (
            <div className="px-3 py-6 text-muted-foreground text-xs">
                No ranked products captured yet for this keyword.
            </div>
        );
    }

    return (
        <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-border border-b">
                    <th className={cn(TH, 'w-px pl-3 text-right')}>#</th>
                    <th className={cn(TH, 'w-px text-center')}>7d</th>
                    <th className={cn(TH, 'w-px text-center')}>30d</th>
                    <th className={cn(TH, 'border-border/50 border-l pl-3 text-left')}>Listing</th>
                    <th className={cn(TH, 'w-px text-right')}>Price</th>
                    <th className={cn(TH, 'w-px text-right')}>Views</th>
                    <th className={cn(TH, 'w-px text-right')}>Favs</th>
                    <th className={cn(TH, 'w-px pr-3')} />
                </tr>
            </thead>
            <tbody>
                {props.rows.map((row) => {
                    const listing = row.listing;
                    const isSyncInFlight = isListingSyncInFlight(listing.syncState);
                    const isRefreshing =
                        isSyncInFlight || props.refreshingById[listing.id] === true;

                    return (
                        <tr
                            className="border-border/50 border-b transition-colors hover:bg-accent/50"
                            key={listing.id}
                        >
                            <td className="w-px whitespace-nowrap py-1.5 pr-2 pl-3 text-right align-middle">
                                <span className="font-semibold text-sm tabular-nums">
                                    #{row.currentRank}
                                </span>
                            </td>
                            <td className="w-px whitespace-nowrap px-2 py-1.5 text-center align-middle">
                                <RankChange value={row.rankChanges.change7d} />
                            </td>
                            <td className="w-px whitespace-nowrap px-2 py-1.5 text-center align-middle">
                                <RankChange value={row.rankChanges.change30d} />
                            </td>
                            <td className="border-border/50 border-l py-1.5 pr-2 pl-3 align-middle">
                                <div className="flex items-center gap-2.5">
                                    <button
                                        className="size-10 shrink-0 cursor-pointer overflow-hidden rounded bg-secondary"
                                        onClick={() => props.onSelectListing(listing)}
                                        title={listing.title}
                                        type="button"
                                    >
                                        {listing.thumbnailUrl ? (
                                            <img
                                                alt=""
                                                className="size-full object-cover"
                                                height={40}
                                                src={listing.thumbnailUrl}
                                                width={40}
                                            />
                                        ) : null}
                                    </button>
                                    <div className="min-w-0">
                                        <button
                                            className="block max-w-full cursor-pointer truncate text-left text-foreground hover:text-primary"
                                            onClick={() => props.onSelectListing(listing)}
                                            title={listing.title}
                                            type="button"
                                        >
                                            {listing.title}
                                        </button>
                                        {listing.shopId && listing.shopName ? (
                                            <button
                                                className="mt-0.5 block max-w-full cursor-pointer truncate text-left text-[11px] text-muted-foreground hover:text-primary"
                                                onClick={() =>
                                                    navigate(toShopActivityPath(listing.shopId), {
                                                        state: {
                                                            etsyShopId: listing.shopId,
                                                            shopName:
                                                                listing.shopName ?? listing.shopId,
                                                        },
                                                    })
                                                }
                                                title={listing.shopName}
                                                type="button"
                                            >
                                                {listing.shopName}
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            </td>
                            <td className="w-px whitespace-nowrap px-2 py-1.5 text-right align-middle text-terminal-green tabular-nums">
                                {formatListingPrice(listing)}
                            </td>
                            <td className="w-px whitespace-nowrap px-2 py-1.5 text-right align-middle text-terminal-dim tabular-nums">
                                {listing.views === null ? '--' : formatNumber(listing.views)}
                            </td>
                            <td className="w-px whitespace-nowrap px-2 py-1.5 text-right align-middle text-terminal-dim tabular-nums">
                                {listing.numFavorers === null
                                    ? '--'
                                    : formatNumber(listing.numFavorers)}
                            </td>
                            <td className="w-px whitespace-nowrap py-1.5 pr-3 pl-2 align-middle">
                                <Button
                                    aria-label={`Refresh ${listing.title}`}
                                    className="size-6 text-terminal-dim hover:text-foreground"
                                    disabled={isRefreshing}
                                    onClick={() => props.onRefresh(listing)}
                                    size="icon-sm"
                                    title="Refresh listing"
                                    type="button"
                                    variant="transparent"
                                >
                                    <RefreshCw
                                        className={cn('size-3.5', isRefreshing && 'animate-spin')}
                                    />
                                </Button>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

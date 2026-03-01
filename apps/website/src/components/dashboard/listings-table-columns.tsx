import { type ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatNumber, timeAgo } from '@/components/ui/dashboard';
import type { TrackedListingItem } from '@/lib/listings-api';
import { cn } from '@/lib/utils';
import { formatListingPrice, isListingSyncInFlight } from './listings-tab-utils';

export interface ListingsColumnMeta {
    cellClassName: string;
    headClassName: string;
    isGrow?: boolean;
}

const columnHelper = createColumnHelper<TrackedListingItem>();
const toHeadClassName = (value: string): string => {
    return `${value} py-2 text-[10px] uppercase tracking-wider text-muted-foreground`;
};

export const getListingsColumnMeta = (meta: unknown): ListingsColumnMeta | undefined => {
    if (!meta || typeof meta !== 'object') {
        return undefined;
    }

    return meta as ListingsColumnMeta;
};

export const createListingsColumns = (params: {
    onOpenListing: (item: TrackedListingItem) => void;
    onOpenShopActivity: (item: TrackedListingItem) => void;
    onRefresh: (item: TrackedListingItem) => void;
    refreshingById: Record<string, boolean>;
}): ColumnDef<TrackedListingItem>[] => {
    return [
        columnHelper.display({
            id: 'thumbnail',
            size: 68,
            header: () => '',
            cell: (context) => {
                const item = context.row.original;

                return (
                    <div className="size-12 overflow-hidden rounded bg-secondary">
                        {item.thumbnailUrl ? (
                            <img
                                alt=""
                                className={[
                                    'size-full max-w-none origin-center scale-[1.2]',
                                    'object-cover',
                                ].join(' ')}
                                height={48}
                                src={item.thumbnailUrl}
                                width={48}
                            />
                        ) : null}
                    </div>
                );
            },
            meta: {
                headClassName: toHeadClassName('pl-3 pr-3 text-left'),
                cellClassName: 'pl-3 pr-3 py-1.5',
            } satisfies ListingsColumnMeta,
        }),
        columnHelper.display({
            id: 'title',
            size: 320,
            header: () => 'Title',
            cell: (context) => {
                const item = context.row.original;

                return (
                    <div className="space-y-0.5">
                        <button
                            className="block min-w-0 max-w-full cursor-pointer truncate text-left hover:text-primary"
                            onClick={() => params.onOpenListing(item)}
                            title={`Open details for ${item.title}`}
                            type="button"
                        >
                            {item.title}
                        </button>
                    </div>
                );
            },
            meta: {
                headClassName: toHeadClassName('pl-2 pr-2 text-left'),
                cellClassName: 'pl-2 pr-2 py-1.5 text-foreground',
                isGrow: true,
            } satisfies ListingsColumnMeta,
        }),
        columnHelper.accessor('shopName', {
            size: 140,
            header: () => 'Shop',
            cell: (context) => {
                const item = context.row.original;
                const shopName = context.getValue();

                if (!(item.shopId && shopName)) {
                    return '--';
                }

                return (
                    <button
                        className="max-w-full cursor-pointer truncate text-left hover:text-primary"
                        onClick={() => params.onOpenShopActivity(item)}
                        title={`Open activity for ${shopName}`}
                        type="button"
                    >
                        {shopName}
                    </button>
                );
            },
            meta: {
                headClassName: toHeadClassName('px-2 text-left'),
                cellClassName: 'truncate px-2 py-1.5',
            } satisfies ListingsColumnMeta,
        }),
        columnHelper.display({
            id: 'price',
            size: 90,
            header: () => 'Price',
            cell: (context) => formatListingPrice(context.row.original),
            meta: {
                headClassName: toHeadClassName('px-2 text-right'),
                cellClassName: 'whitespace-nowrap px-2 py-1.5 text-right text-terminal-green',
            } satisfies ListingsColumnMeta,
        }),
        columnHelper.accessor('views', {
            size: 80,
            header: () => 'Views',
            cell: (context) => {
                const views = context.getValue();
                return views === null ? '--' : formatNumber(views);
            },
            meta: {
                headClassName: toHeadClassName('px-2 text-right'),
                cellClassName: 'whitespace-nowrap px-2 py-1.5 text-right text-terminal-dim',
            } satisfies ListingsColumnMeta,
        }),
        columnHelper.accessor('numFavorers', {
            size: 70,
            header: () => 'Favs',
            cell: (context) => {
                const numFavorers = context.getValue();
                return numFavorers === null ? '--' : formatNumber(numFavorers);
            },
            meta: {
                headClassName: toHeadClassName('px-2 text-right'),
                cellClassName: 'whitespace-nowrap px-2 py-1.5 text-right text-terminal-dim',
            } satisfies ListingsColumnMeta,
        }),
        columnHelper.accessor('quantity', {
            size: 50,
            header: () => 'Qty',
            cell: (context) => context.getValue() ?? '--',
            meta: {
                headClassName: toHeadClassName('px-2 text-center'),
                cellClassName: 'whitespace-nowrap px-2 py-1.5 text-center',
            } satisfies ListingsColumnMeta,
        }),
        columnHelper.accessor('lastRefreshedAt', {
            size: 110,
            header: () => 'Refreshed',
            cell: (context) => timeAgo(context.getValue()),
            meta: {
                headClassName: toHeadClassName('px-2 text-right'),
                cellClassName: 'px-2 py-1.5 text-right text-terminal-dim',
            } satisfies ListingsColumnMeta,
        }),
        columnHelper.display({
            id: 'refresh',
            size: 44,
            header: () => '',
            cell: (context) => {
                const item = context.row.original;
                const isQueuedOrSyncing = isListingSyncInFlight(item);
                const isRefreshing = isQueuedOrSyncing || params.refreshingById[item.id] === true;
                let refreshTitle = 'Refresh listing';
                let refreshAriaLabel = `Refresh ${item.title}`;

                if (isQueuedOrSyncing) {
                    refreshTitle = 'Listing sync in progress';
                    refreshAriaLabel = `Syncing ${item.title}`;
                } else if (isRefreshing) {
                    refreshTitle = 'Refreshing listing';
                    refreshAriaLabel = `Refreshing ${item.title}`;
                }

                return (
                    <Button
                        aria-label={refreshAriaLabel}
                        className="size-6 text-terminal-dim hover:text-foreground"
                        disabled={isRefreshing}
                        onClick={() => params.onRefresh(item)}
                        size="icon-sm"
                        title={refreshTitle}
                        type="button"
                        variant="transparent"
                    >
                        <RefreshCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
                    </Button>
                );
            },
            meta: {
                headClassName: toHeadClassName('px-2 text-right'),
                cellClassName: 'px-2 py-1.5 text-right',
            } satisfies ListingsColumnMeta,
        }),
    ];
};

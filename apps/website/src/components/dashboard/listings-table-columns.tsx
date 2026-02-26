import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { RefreshCw } from 'lucide-react';
import type { TrackedListingItem } from '@/lib/listings-api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    formatNumber,
    timeAgo
} from '@/components/ui/dashboard';
import {
    formatListingPrice,
    isListingSyncInFlight
} from './listings-tab-utils';

export type ListingsColumnMeta = {
    cellClassName: string;
    headClassName: string;
    isGrow?: boolean;
};

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
                                src={item.thumbnailUrl}
                                alt=""
                                className={[
                                    'size-full max-w-none origin-center scale-[1.2]',
                                    'object-cover'
                                ].join(' ')}
                            />
                        ) : null}
                    </div>
                );
            },
            meta: {
                headClassName: toHeadClassName('pl-3 pr-3 text-left'),
                cellClassName: 'pl-3 pr-3 py-1.5'
            } satisfies ListingsColumnMeta
        }),
        columnHelper.display({
            id: 'title',
            size: 320,
            header: () => 'Title',
            cell: (context) => {
                const item = context.row.original;

                return (
                    <div className="space-y-0.5">
                        <a
                            href={item.url ?? undefined}
                            target="_blank"
                            rel="noreferrer"
                            className="block min-w-0 truncate hover:text-primary"
                        >
                            {item.title}
                        </a>
                        <div className="truncate font-semibold text-foreground">
                            {item.shopName ?? '--'}
                        </div>
                    </div>
                );
            },
            meta: {
                headClassName: toHeadClassName('pl-2 pr-2 text-left'),
                cellClassName: 'pl-2 pr-2 py-1.5 text-foreground',
                isGrow: true
            } satisfies ListingsColumnMeta
        }),
        columnHelper.accessor('shopName', {
            size: 100,
            header: () => 'Shop',
            cell: (context) => context.getValue() ?? '--',
            meta: {
                headClassName: toHeadClassName('px-2 text-left'),
                cellClassName: 'truncate px-2 py-1.5'
            } satisfies ListingsColumnMeta
        }),
        columnHelper.display({
            id: 'price',
            size: 90,
            header: () => 'Price',
            cell: (context) => formatListingPrice(context.row.original),
            meta: {
                headClassName: toHeadClassName('px-2 text-right'),
                cellClassName: 'whitespace-nowrap px-2 py-1.5 text-right text-terminal-green'
            } satisfies ListingsColumnMeta
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
                cellClassName: 'whitespace-nowrap px-2 py-1.5 text-right text-terminal-dim'
            } satisfies ListingsColumnMeta
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
                cellClassName: 'whitespace-nowrap px-2 py-1.5 text-right text-terminal-dim'
            } satisfies ListingsColumnMeta
        }),
        columnHelper.accessor('quantity', {
            size: 50,
            header: () => 'Qty',
            cell: (context) => context.getValue() ?? '--',
            meta: {
                headClassName: toHeadClassName('px-2 text-center'),
                cellClassName: 'whitespace-nowrap px-2 py-1.5 text-center'
            } satisfies ListingsColumnMeta
        }),
        columnHelper.accessor('lastRefreshedAt', {
            size: 110,
            header: () => 'Refreshed',
            cell: (context) => timeAgo(context.getValue()),
            meta: {
                headClassName: toHeadClassName('px-2 text-right'),
                cellClassName: 'px-2 py-1.5 text-right text-terminal-dim'
            } satisfies ListingsColumnMeta
        }),
        columnHelper.display({
            id: 'refresh',
            size: 44,
            header: () => '',
            cell: (context) => {
                const item = context.row.original;
                const isQueuedOrSyncing = isListingSyncInFlight(item);
                const isRefreshing =
                    isQueuedOrSyncing || params.refreshingById[item.id] === true;
                const refreshTitle = isQueuedOrSyncing
                    ? 'Listing sync in progress'
                    : isRefreshing
                      ? 'Refreshing listing'
                      : 'Refresh listing';
                const refreshAriaLabel = isQueuedOrSyncing
                    ? `Syncing ${item.title}`
                    : isRefreshing
                      ? `Refreshing ${item.title}`
                      : `Refresh ${item.title}`;

                return (
                    <Button
                        type="button"
                        variant="transparent"
                        size="icon-sm"
                        onClick={() => params.onRefresh(item)}
                        disabled={isRefreshing}
                        aria-label={refreshAriaLabel}
                        title={refreshTitle}
                        className="size-6 text-terminal-dim hover:text-foreground"
                    >
                        <RefreshCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
                    </Button>
                );
            },
            meta: {
                headClassName: toHeadClassName('px-2 text-right'),
                cellClassName: 'px-2 py-1.5 text-right'
            } satisfies ListingsColumnMeta
        })
    ];
};

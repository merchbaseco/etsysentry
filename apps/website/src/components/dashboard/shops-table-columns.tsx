import { type ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge, timeAgo, timeUntil } from '@/components/ui/dashboard';
import type { TrackedShopItem } from '@/lib/shops-api';
import { cn } from '@/lib/utils';

export interface ShopsColumnMeta {
    cellClassName: string;
    headClassName: string;
    isGrow?: boolean;
}

const columnHelper = createColumnHelper<TrackedShopItem>();

const toHeadClassName = (value: string): string => {
    return `${value} py-2 text-[10px] uppercase tracking-wider text-muted-foreground`;
};

const isShopSyncInFlight = (item: TrackedShopItem): boolean => {
    return item.syncState === 'queued' || item.syncState === 'syncing';
};

const formatMetricWithDelta = (total: number | null, delta: number | null): string => {
    const totalValue = total ?? 0;
    if (delta === null) {
        return String(totalValue);
    }

    const sign = delta > 0 ? '+' : '';
    return `${totalValue} (${sign}${delta})`;
};

export const getShopsColumnMeta = (meta: unknown): ShopsColumnMeta | undefined => {
    if (!meta || typeof meta !== 'object') {
        return undefined;
    }

    return meta as ShopsColumnMeta;
};

export const createShopsColumns = (params: {
    onRefresh: (item: TrackedShopItem) => void;
    refreshingById: Record<string, boolean>;
}): ColumnDef<TrackedShopItem>[] => {
    return [
        columnHelper.display({
            id: 'shop',
            size: 260,
            header: () => 'Shop',
            cell: (context) => {
                const item = context.row.original;

                return (
                    <div className="min-w-0">
                        <div className="truncate font-medium">{item.shopName}</div>
                        <div className="truncate text-[11px] text-terminal-dim">
                            {item.etsyShopId}
                        </div>
                    </div>
                );
            },
            meta: {
                headClassName: toHeadClassName('px-3 text-left'),
                cellClassName: 'px-3 py-1.5 text-foreground',
                isGrow: true,
            } satisfies ShopsColumnMeta,
        }),
        columnHelper.accessor('syncState', {
            size: 80,
            header: () => 'Sync',
            cell: (context) => context.getValue(),
            meta: {
                headClassName: toHeadClassName('px-2 text-center'),
                cellClassName: 'px-2 py-1.5 text-center text-terminal-dim',
            } satisfies ShopsColumnMeta,
        }),
        columnHelper.display({
            id: 'active',
            size: 80,
            header: () => 'Active',
            cell: (context) => context.row.original.latestSnapshot?.activeListingCount ?? 0,
            meta: {
                headClassName: toHeadClassName('px-2 text-right'),
                cellClassName: 'px-2 py-1.5 text-right text-terminal-dim',
            } satisfies ShopsColumnMeta,
        }),
        columnHelper.display({
            id: 'new',
            size: 80,
            header: () => 'New',
            cell: (context) => context.row.original.latestSnapshot?.newListingCount ?? 0,
            meta: {
                headClassName: toHeadClassName('px-2 text-right'),
                cellClassName: 'px-2 py-1.5 text-right text-terminal-dim',
            } satisfies ShopsColumnMeta,
        }),
        columnHelper.display({
            id: 'favs',
            size: 120,
            header: () => 'Favs',
            cell: (context) =>
                formatMetricWithDelta(
                    context.row.original.latestSnapshot?.favoritesTotal ?? null,
                    context.row.original.latestSnapshot?.favoritesDelta ?? null
                ),
            meta: {
                headClassName: toHeadClassName('px-2 text-right'),
                cellClassName: 'px-2 py-1.5 text-right text-terminal-dim',
            } satisfies ShopsColumnMeta,
        }),
        columnHelper.display({
            id: 'sold',
            size: 120,
            header: () => 'Sold',
            cell: (context) =>
                formatMetricWithDelta(
                    context.row.original.latestSnapshot?.soldTotal ?? null,
                    context.row.original.latestSnapshot?.soldDelta ?? null
                ),
            meta: {
                headClassName: toHeadClassName('px-2 text-right'),
                cellClassName: 'px-2 py-1.5 text-right text-terminal-dim',
            } satisfies ShopsColumnMeta,
        }),
        columnHelper.display({
            id: 'reviews',
            size: 120,
            header: () => 'Reviews',
            cell: (context) =>
                formatMetricWithDelta(
                    context.row.original.latestSnapshot?.reviewTotal ?? null,
                    context.row.original.latestSnapshot?.reviewDelta ?? null
                ),
            meta: {
                headClassName: toHeadClassName('px-2 text-right'),
                cellClassName: 'px-2 py-1.5 text-right text-terminal-dim',
            } satisfies ShopsColumnMeta,
        }),
        columnHelper.accessor('lastRefreshedAt', {
            size: 110,
            header: () => 'Refreshed',
            cell: (context) => timeAgo(context.getValue()),
            meta: {
                headClassName: toHeadClassName('px-2 text-right'),
                cellClassName: 'px-2 py-1.5 text-right text-terminal-dim',
            } satisfies ShopsColumnMeta,
        }),
        columnHelper.accessor('nextSyncAt', {
            size: 110,
            header: () => 'Next Sync',
            cell: (context) => timeUntil(context.getValue()),
            meta: {
                headClassName: toHeadClassName('px-2 text-right'),
                cellClassName: 'px-2 py-1.5 text-right text-terminal-dim',
            } satisfies ShopsColumnMeta,
        }),
        columnHelper.accessor('trackingState', {
            size: 76,
            header: () => 'State',
            cell: (context) => <StatusBadge status={context.getValue()} />,
            meta: {
                headClassName: toHeadClassName('px-2 text-center'),
                cellClassName: 'px-2 py-1.5 items-center justify-center',
            } satisfies ShopsColumnMeta,
        }),
        columnHelper.display({
            id: 'refresh',
            size: 44,
            header: () => '',
            cell: (context) => {
                const item = context.row.original;
                const isQueuedOrSyncing = isShopSyncInFlight(item);
                const isRefreshing = isQueuedOrSyncing || params.refreshingById[item.id] === true;

                return (
                    <Button
                        aria-label={`Refresh ${item.shopName}`}
                        className="size-6 text-terminal-dim hover:text-foreground"
                        disabled={isRefreshing}
                        onClick={() => params.onRefresh(item)}
                        size="icon-sm"
                        title={isQueuedOrSyncing ? 'Shop sync in progress' : 'Refresh shop'}
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
            } satisfies ShopsColumnMeta,
        }),
    ];
};

import type { MouseEvent } from 'react';
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

type ListingsTableProps = {
    items: TrackedListingItem[];
    onRefresh: (item: TrackedListingItem) => void;
    onRowMouseEnter: (
        event: MouseEvent<HTMLTableRowElement>,
        item: TrackedListingItem
    ) => void;
    onRowMouseLeave: () => void;
    onRowMouseMove: (
        event: MouseEvent<HTMLTableRowElement>,
        item: TrackedListingItem
    ) => void;
    refreshingById: Record<string, boolean>;
};

export function ListingsTable(props: ListingsTableProps) {
    return (
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
                {props.items.map((item) => {
                    const isQueuedOrSyncing = isListingSyncInFlight(item);
                    const isRefreshing = isQueuedOrSyncing || props.refreshingById[item.id] === true;
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
                        <tr
                            key={item.id}
                            data-row-id={item.id}
                            className="border-b border-border/50"
                            onMouseEnter={(event) => props.onRowMouseEnter(event, item)}
                            onMouseMove={(event) => props.onRowMouseMove(event, item)}
                            onMouseLeave={props.onRowMouseLeave}
                        >
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
                            </td>
                            <td className="truncate px-2 py-1.5">{item.shopName ?? '--'}</td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-right text-terminal-green">
                                {formatListingPrice(item)}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-right text-terminal-dim">
                                {item.views === null ? '--' : formatNumber(item.views)}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-right text-terminal-dim">
                                {item.numFavorers === null ? '--' : formatNumber(item.numFavorers)}
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
                                        onClick={() => props.onRefresh(item)}
                                        disabled={isRefreshing}
                                        aria-label={refreshAriaLabel}
                                        title={refreshTitle}
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
    );
}

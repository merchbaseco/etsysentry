import { RefreshCw } from 'lucide-react';
import { type TrackedShopItem } from '@/lib/shops-api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StatusBadge, timeAgo, timeUntil } from '@/components/ui/dashboard';

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

export const ShopsTable = (params: {
    items: TrackedShopItem[];
    refreshingById: Record<string, boolean>;
    onRefresh: (item: TrackedShopItem) => Promise<void>;
}) => {
    return (
        <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-border">
                    <th className="w-[44px] px-2 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground" />
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">Shop</th>
                    <th className="w-[80px] px-2 py-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">Sync</th>
                    <th className="w-[80px] px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Active</th>
                    <th className="w-[80px] px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">New</th>
                    <th className="w-[120px] px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Favs</th>
                    <th className="w-[120px] px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Sold</th>
                    <th className="w-[120px] px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Reviews</th>
                    <th className="w-[110px] px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Refreshed</th>
                    <th className="w-[110px] px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Next Sync</th>
                    <th className="w-[76px] px-2 py-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">State</th>
                </tr>
            </thead>
            <tbody>
                {params.items.map((item) => {
                    const isQueuedOrSyncing = isShopSyncInFlight(item);
                    const isRefreshing = isQueuedOrSyncing || params.refreshingById[item.id] === true;

                    return (
                        <tr key={item.id} className="border-b border-border/50">
                            <td className="px-2 py-1.5">
                                <Button
                                    type="button"
                                    variant="transparent"
                                    size="icon-sm"
                                    onClick={() => void params.onRefresh(item)}
                                    disabled={isRefreshing}
                                    aria-label={`Refresh ${item.shopName}`}
                                    title={isQueuedOrSyncing ? 'Shop sync in progress' : 'Refresh shop'}
                                    className="size-6 text-terminal-dim hover:text-foreground"
                                >
                                    <RefreshCw
                                        className={cn(
                                            'size-3.5',
                                            isRefreshing && 'animate-spin'
                                        )}
                                    />
                                </Button>
                            </td>
                            <td className="px-3 py-1.5 text-foreground">
                                <div className="font-medium">{item.shopName}</div>
                                <div className="text-[11px] text-terminal-dim">{item.etsyShopId}</div>
                            </td>
                            <td className="px-2 py-1.5 text-center text-terminal-dim">{item.syncState}</td>
                            <td className="px-2 py-1.5 text-right text-terminal-dim">
                                {item.latestSnapshot?.activeListingCount ?? 0}
                            </td>
                            <td className="px-2 py-1.5 text-right text-terminal-dim">
                                {item.latestSnapshot?.newListingCount ?? 0}
                            </td>
                            <td className="px-2 py-1.5 text-right text-terminal-dim">
                                {formatMetricWithDelta(
                                    item.latestSnapshot?.favoritesTotal ?? null,
                                    item.latestSnapshot?.favoritesDelta ?? null
                                )}
                            </td>
                            <td className="px-2 py-1.5 text-right text-terminal-dim">
                                {formatMetricWithDelta(
                                    item.latestSnapshot?.soldTotal ?? null,
                                    item.latestSnapshot?.soldDelta ?? null
                                )}
                            </td>
                            <td className="px-2 py-1.5 text-right text-terminal-dim">
                                {formatMetricWithDelta(
                                    item.latestSnapshot?.reviewTotal ?? null,
                                    item.latestSnapshot?.reviewDelta ?? null
                                )}
                            </td>
                            <td className="px-2 py-1.5 text-right text-terminal-dim">
                                {timeAgo(item.lastRefreshedAt)}
                            </td>
                            <td className="px-2 py-1.5 text-right text-terminal-dim">
                                {timeUntil(item.nextSyncAt)}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                                <StatusBadge status={item.trackingState} />
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

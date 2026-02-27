import { type ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge, timeAgo, timeUntil } from '@/components/ui/dashboard';
import type { TrackedKeywordItem } from '@/lib/keywords-api';
import { cn } from '@/lib/utils';

export interface KeywordsColumnMeta {
    cellClassName: string;
    headClassName: string;
    isGrow?: boolean;
}

const columnHelper = createColumnHelper<TrackedKeywordItem>();

const toHeadClassName = (value: string): string => {
    return `${value} py-2 text-[10px] uppercase tracking-wider text-muted-foreground`;
};

const isKeywordSyncInFlight = (item: TrackedKeywordItem): boolean => {
    return item.syncState === 'queued' || item.syncState === 'syncing';
};

export const getKeywordsColumnMeta = (meta: unknown): KeywordsColumnMeta | undefined => {
    if (!meta || typeof meta !== 'object') {
        return undefined;
    }

    return meta as KeywordsColumnMeta;
};

export const createKeywordsColumns = (params: {
    onRefresh: (item: TrackedKeywordItem) => void;
    refreshingById: Record<string, boolean>;
}): ColumnDef<TrackedKeywordItem>[] => {
    return [
        columnHelper.display({
            id: 'keyword',
            size: 320,
            header: () => 'Keyword',
            cell: (context) => {
                const item = context.row.original;

                return (
                    <div className="min-w-0">
                        <div className="truncate font-medium">{item.keyword}</div>
                        <div className="truncate text-[11px] text-terminal-dim">
                            {item.normalizedKeyword}
                        </div>
                    </div>
                );
            },
            meta: {
                headClassName: toHeadClassName('px-3 text-left'),
                cellClassName: 'px-3 py-1.5 text-foreground',
                isGrow: true,
            } satisfies KeywordsColumnMeta,
        }),
        columnHelper.accessor('trackingState', {
            size: 90,
            header: () => 'State',
            cell: (context) => <StatusBadge status={context.getValue()} />,
            meta: {
                headClassName: toHeadClassName('px-2 text-center'),
                cellClassName: 'px-2 py-1.5 text-center',
            } satisfies KeywordsColumnMeta,
        }),
        columnHelper.accessor('lastRefreshedAt', {
            size: 120,
            header: () => 'Last Refreshed',
            cell: (context) => timeAgo(context.getValue()),
            meta: {
                headClassName: toHeadClassName('px-2 text-right'),
                cellClassName: 'px-2 py-1.5 text-right text-terminal-dim',
            } satisfies KeywordsColumnMeta,
        }),
        columnHelper.accessor('updatedAt', {
            size: 100,
            header: () => 'Updated',
            cell: (context) => timeAgo(context.getValue()),
            meta: {
                headClassName: toHeadClassName('px-2 text-right'),
                cellClassName: 'px-2 py-1.5 text-right text-terminal-dim',
            } satisfies KeywordsColumnMeta,
        }),
        columnHelper.accessor('nextSyncAt', {
            size: 110,
            header: () => 'Next Sync',
            cell: (context) => timeUntil(context.getValue()),
            meta: {
                headClassName: toHeadClassName('px-2 text-right'),
                cellClassName: 'px-2 py-1.5 text-right text-terminal-dim',
            } satisfies KeywordsColumnMeta,
        }),
        columnHelper.display({
            id: 'refresh',
            size: 44,
            header: () => '',
            cell: (context) => {
                const item = context.row.original;
                const isSyncInFlight = isKeywordSyncInFlight(item);
                const isRefreshing = isSyncInFlight || params.refreshingById[item.id] === true;

                return (
                    <Button
                        aria-label={`Refresh ${item.keyword}`}
                        className="size-6 text-terminal-dim hover:text-foreground"
                        disabled={isRefreshing}
                        onClick={(event) => {
                            event.stopPropagation();
                            params.onRefresh(item);
                        }}
                        size="icon-sm"
                        title={isSyncInFlight ? 'Keyword sync in progress' : 'Refresh keyword'}
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
            } satisfies KeywordsColumnMeta,
        }),
    ];
};

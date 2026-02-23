'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    listEventLogs,
    type EventLogCursor,
    type EventLogItem,
    type EventLogLevel,
    type EventLogPrimitiveType,
    type EventLogStatus,
    type ListEventLogsOutput
} from '@/lib/logs-api';
import { logsInvalidatedEventName } from '@/hooks/use-realtime-query-invalidations';
import { TrpcRequestError } from '@/lib/trpc-http';
import { cn } from '@/lib/utils';
import { LogsDetailPanel } from './logs-detail-panel';
import {
    LOG_LEVELS,
    LOG_STATUSES,
    LOG_TYPES,
    LogLevelBadge,
    PrimitiveTypeBadge,
    formatLogTime,
    getTargetLabel
} from './logs-ui';
import {
    Download,
    EmptyState,
    FilterBar,
    FilterChip,
    FilterGroup,
    Pause,
    Play,
    StatusBadge,
    TopToolbar
} from './shared';

const PAGE_SIZE = 20;

type EventLogPage = Pick<ListEventLogsOutput, 'items' | 'nextCursor'>;

const toErrorMessage = (error: unknown): string => {
    if (error instanceof TrpcRequestError) {
        return error.message;
    }

    if (error instanceof Error && error.message.length > 0) {
        return error.message;
    }

    return 'Unexpected request failure.';
};


export function LogsTab() {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState<EventLogPage[]>([]);
    const [filterLevel, setFilterLevel] = useState<EventLogLevel | null>(null);
    const [filterStatus, setFilterStatus] = useState<EventLogStatus | null>(null);
    const [filterType, setFilterType] = useState<EventLogPrimitiveType | null>(null);
    const [liveMode, setLiveMode] = useState(false);
    const [selectedLog, setSelectedLog] = useState<EventLogItem | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const getQueryInput = useCallback(
        (cursor?: EventLogCursor | null) => ({
            cursor: cursor ?? undefined,
            levels: filterLevel ? [filterLevel] : undefined,
            limit: PAGE_SIZE,
            primitiveTypes: filterType ? [filterType] : undefined,
            search: search.trim().length > 0 ? search.trim() : undefined,
            statuses: filterStatus ? [filterStatus] : undefined
        }),
        [filterLevel, filterStatus, filterType, search]
    );

    const loadFirstPage = useCallback(async () => {
        setIsLoading(true);

        try {
            const response = await listEventLogs(getQueryInput());

            setPages([response]);
            setPage(1);
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toErrorMessage(error));
            setPages([]);
            setPage(1);
        } finally {
            setIsLoading(false);
        }
    }, [getQueryInput]);

    useEffect(() => {
        void loadFirstPage();
    }, [loadFirstPage]);

    useEffect(() => {
        if (!liveMode) {
            return;
        }

        const intervalId = window.setInterval(() => {
            void loadFirstPage();
        }, 15_000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [liveMode, loadFirstPage]);

    useEffect(() => {
        const onInvalidated = () => {
            void loadFirstPage();
        };

        window.addEventListener(logsInvalidatedEventName, onInvalidated);

        return () => {
            window.removeEventListener(logsInvalidatedEventName, onInvalidated);
        };
    }, [loadFirstPage]);

    const currentPage = pages[page - 1];
    const paginated = currentPage?.items ?? [];

    const hasNextPage = useMemo(() => {
        if (page < pages.length) {
            return true;
        }

        return Boolean(currentPage?.nextCursor);
    }, [currentPage?.nextCursor, page, pages.length]);

    const handleNextPage = useCallback(async () => {
        if (page < pages.length) {
            setPage((current) => current + 1);
            return;
        }

        if (!currentPage?.nextCursor) {
            return;
        }

        setIsLoading(true);

        try {
            const response = await listEventLogs(getQueryInput(currentPage.nextCursor));

            setPages((existing) => [...existing, response]);
            setPage((current) => current + 1);
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    }, [currentPage?.nextCursor, getQueryInput, page, pages.length]);

    return (
        <div className="flex h-full flex-col">
            <TopToolbar search={search} onSearchChange={setSearch}>
                <FilterBar>
                    <FilterGroup label="Level">
                        {LOG_LEVELS.map((levelValue) => (
                            <FilterChip
                                key={levelValue}
                                active={filterLevel === levelValue}
                                label={levelValue}
                                onClick={() => setFilterLevel(filterLevel === levelValue ? null : levelValue)}
                            />
                        ))}
                    </FilterGroup>
                    <FilterGroup label="Status">
                        {LOG_STATUSES.map((statusValue) => (
                            <FilterChip
                                key={statusValue}
                                active={filterStatus === statusValue}
                                label={statusValue}
                                onClick={() =>
                                    setFilterStatus(filterStatus === statusValue ? null : statusValue)
                                }
                            />
                        ))}
                    </FilterGroup>
                    <FilterGroup label="Type">
                        {LOG_TYPES.map((typeValue) => (
                            <FilterChip
                                key={typeValue}
                                active={filterType === typeValue}
                                label={typeValue}
                                onClick={() => setFilterType(filterType === typeValue ? null : typeValue)}
                            />
                        ))}
                    </FilterGroup>
                </FilterBar>
                <div className="ml-auto flex items-center gap-1.5">
                    <button
                        onClick={() => setLiveMode(!liveMode)}
                        className={cn(
                            'flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-[10px] transition-colors',
                            liveMode
                                ? 'border-terminal-green/30 bg-terminal-green/10 text-terminal-green'
                                : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {liveMode ? <Pause className="size-3" /> : <Play className="size-3" />}
                        {liveMode ? 'Live' : 'Paused'}
                    </button>
                    <button className="flex cursor-pointer items-center gap-1.5 rounded border border-border bg-secondary px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground">
                        <Download className="size-3" />
                        Export
                    </button>
                </div>
            </TopToolbar>

            {errorMessage ? (
                <div className="border-b border-terminal-red/20 bg-terminal-red/10 px-3 py-2 text-xs text-terminal-red">
                    {errorMessage}
                </div>
            ) : null}

            <div className="flex-1 overflow-auto">
                {isLoading && pages.length === 0 ? (
                    <div className="px-3 py-6 text-xs text-muted-foreground">Loading event logs...</div>
                ) : paginated.length === 0 ? (
                    <EmptyState message="No logs match your filters." />
                ) : (
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 z-10 bg-card">
                            <tr className="border-b border-border">
                                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">Time</th>
                                <th className="px-2 py-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">Level</th>
                                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">Action</th>
                                <th className="px-2 py-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">Type</th>
                                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">Target</th>
                                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">Message</th>
                                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">Run ID</th>
                                <th className="px-2 py-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.map((logItem) => (
                                <tr
                                    key={logItem.id}
                                    onClick={() => setSelectedLog(logItem)}
                                    className={cn(
                                        'cursor-pointer border-b border-border/50 transition-colors hover:bg-accent/50',
                                        logItem.level === 'error' && 'bg-terminal-red/3',
                                        logItem.level === 'warn' && 'bg-terminal-yellow/3'
                                    )}
                                >
                                    <td className="font-mono whitespace-nowrap px-3 py-1 text-terminal-dim">
                                        {formatLogTime(logItem.occurredAt)}
                                    </td>
                                    <td className="px-2 py-1 text-center">
                                        <LogLevelBadge level={logItem.level} />
                                    </td>
                                    <td className="px-2 py-1 font-mono text-foreground">{logItem.action}</td>
                                    <td className="px-2 py-1 text-center">
                                        <PrimitiveTypeBadge type={logItem.primitiveType} />
                                    </td>
                                    <td className="px-2 py-1 font-mono text-terminal-dim">{getTargetLabel(logItem)}</td>
                                    <td className="max-w-64 truncate px-2 py-1 text-secondary-foreground">{logItem.message}</td>
                                    <td className="px-2 py-1 font-mono text-terminal-dim">{logItem.monitorRunId ?? '--'}</td>
                                    <td className="px-2 py-1 text-center">
                                        <StatusBadge status={logItem.status} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
                <span>Page {page}</span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page <= 1 || isLoading}
                        className="rounded border border-border bg-secondary px-2 py-1 transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-40"
                    >
                        Prev
                    </button>
                    <button
                        onClick={() => void handleNextPage()}
                        disabled={!hasNextPage || isLoading}
                        className="rounded border border-border bg-secondary px-2 py-1 transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-40"
                    >
                        Next
                    </button>
                </div>
            </div>

            <LogsDetailPanel selectedLog={selectedLog} onClose={() => setSelectedLog(null)} />
        </div>
    );
}

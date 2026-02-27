'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { EmptyState } from '@/components/ui/dashboard';
import { logsInvalidatedEventName } from '@/hooks/use-realtime-query-invalidations';
import {
    type EventLogCursor,
    type EventLogItem,
    type EventLogLevel,
    type EventLogPrimitiveType,
    type EventLogStatus,
    listEventLogs,
} from '@/lib/logs-api';
import { captureScrollAnchor, isScrollNearTop, restoreScrollAnchor } from '@/lib/scroll-anchor';
import { TrpcRequestError } from '@/lib/trpc-http';
import { LogsDetailPanel } from './logs-detail-panel';
import { LogsTable } from './logs-table';
import { LogsToolbar } from './logs-toolbar';

const PAGE_SIZE = 20;

const toErrorMessage = (error: unknown): string => {
    if (error instanceof TrpcRequestError) {
        return error.message;
    }

    if (error instanceof Error && error.message.length > 0) {
        return error.message;
    }

    return 'Unexpected request failure.';
};

const mergeHeadLogs = (existing: EventLogItem[], incoming: EventLogItem[]): EventLogItem[] => {
    if (incoming.length === 0) {
        return existing;
    }

    const existingIds = new Set(existing.map((item) => item.id));
    const uniqueIncoming = incoming.filter((item) => !existingIds.has(item.id));

    if (uniqueIncoming.length === 0) {
        return existing;
    }

    return [...uniqueIncoming, ...existing];
};

export function LogsTab() {
    const [search, setSearch] = useState('');
    const [logs, setLogs] = useState<EventLogItem[]>([]);
    const [nextCursor, setNextCursor] = useState<EventLogCursor | null>(null);
    const [pendingHeadLogs, setPendingHeadLogs] = useState<EventLogItem[]>([]);
    const [filterLevel, setFilterLevel] = useState<EventLogLevel | null>(null);
    const [filterStatus, setFilterStatus] = useState<EventLogStatus | null>(null);
    const [filterType, setFilterType] = useState<EventLogPrimitiveType | null>(null);
    const [liveMode, setLiveMode] = useState(false);
    const [selectedLog, setSelectedLog] = useState<EventLogItem | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const scrollViewportRef = useRef<HTMLDivElement | null>(null);
    const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);

    const getQueryInput = useCallback(
        (cursor?: EventLogCursor | null) => ({
            cursor: cursor ?? undefined,
            levels: filterLevel ? [filterLevel] : undefined,
            limit: PAGE_SIZE,
            primitiveTypes: filterType ? [filterType] : undefined,
            search: search.trim().length > 0 ? search.trim() : undefined,
            statuses: filterStatus ? [filterStatus] : undefined,
        }),
        [filterLevel, filterStatus, filterType, search]
    );

    const loadFirstPage = useCallback(async () => {
        setIsLoading(true);
        setIsLoadingMore(false);
        setPendingHeadLogs([]);

        try {
            const response = await listEventLogs(getQueryInput());

            setLogs(response.items);
            setNextCursor(response.nextCursor);
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toErrorMessage(error));
            setLogs([]);
            setNextCursor(null);
            setPendingHeadLogs([]);
        } finally {
            setIsLoading(false);
        }
    }, [getQueryInput]);

    const refreshHeadPage = useCallback(async () => {
        try {
            const response = await listEventLogs(getQueryInput());
            const container = scrollViewportRef.current;
            const nearTop = container ? isScrollNearTop(container, 48) : true;

            if (nearTop) {
                setLogs((current) => {
                    const withPending =
                        pendingHeadLogs.length > 0
                            ? mergeHeadLogs(current, pendingHeadLogs)
                            : current;

                    return mergeHeadLogs(withPending, response.items);
                });
                setPendingHeadLogs([]);
            } else {
                setPendingHeadLogs((current) => mergeHeadLogs(current, response.items));
            }

            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toErrorMessage(error));
        }
    }, [getQueryInput, pendingHeadLogs]);

    useEffect(() => {
        loadFirstPage();
    }, [loadFirstPage]);

    useEffect(() => {
        if (!liveMode) {
            return;
        }

        const intervalId = window.setInterval(() => {
            refreshHeadPage();
        }, 15_000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [liveMode, refreshHeadPage]);

    useEffect(() => {
        const onInvalidated = () => {
            refreshHeadPage();
        };

        window.addEventListener(logsInvalidatedEventName, onInvalidated);

        return () => {
            window.removeEventListener(logsInvalidatedEventName, onInvalidated);
        };
    }, [refreshHeadPage]);

    const applyPendingHeadLogs = useCallback(() => {
        if (pendingHeadLogs.length === 0) {
            return;
        }

        const container = scrollViewportRef.current;
        const anchor = container ? captureScrollAnchor(container) : null;

        setLogs((current) => mergeHeadLogs(current, pendingHeadLogs));
        setPendingHeadLogs([]);

        if (!container) {
            return;
        }

        window.requestAnimationFrame(() => {
            restoreScrollAnchor(container, anchor);
        });
    }, [pendingHeadLogs]);

    const handleLoadMore = useCallback(async () => {
        if (isLoading || isLoadingMore || !nextCursor) {
            return;
        }

        setIsLoadingMore(true);

        try {
            const response = await listEventLogs(getQueryInput(nextCursor));

            setLogs((existing) => [...existing, ...response.items]);
            setNextCursor(response.nextCursor);
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(toErrorMessage(error));
        } finally {
            setIsLoadingMore(false);
        }
    }, [getQueryInput, isLoading, isLoadingMore, nextCursor]);

    useEffect(() => {
        const observerRoot = scrollViewportRef.current;
        const loadMoreTarget = loadMoreTriggerRef.current;

        if (!(observerRoot && loadMoreTarget)) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    handleLoadMore();
                }
            },
            {
                root: observerRoot,
                rootMargin: '200px 0px 200px 0px',
            }
        );

        observer.observe(loadMoreTarget);
        return () => {
            observer.disconnect();
        };
    }, [handleLoadMore]);

    let logsContent: ReactNode;
    if (isLoading && logs.length === 0) {
        logsContent = (
            <div className="px-3 py-6 text-muted-foreground text-xs">Loading event logs...</div>
        );
    } else if (logs.length === 0) {
        logsContent = <EmptyState message="No logs match your filters." />;
    } else {
        logsContent = (
            <LogsTable
                hasMore={Boolean(nextCursor)}
                isLoadingMore={isLoadingMore}
                items={logs}
                loadMoreTriggerRef={loadMoreTriggerRef}
                onSelectLog={setSelectedLog}
            />
        );
    }

    return (
        <div className="flex h-full flex-col">
            <LogsToolbar
                filterLevel={filterLevel}
                filterStatus={filterStatus}
                filterType={filterType}
                liveMode={liveMode}
                onSearchChange={setSearch}
                onToggleFilterLevel={(value) =>
                    setFilterLevel((current) => (current === value ? null : value))
                }
                onToggleFilterStatus={(value) =>
                    setFilterStatus((current) => (current === value ? null : value))
                }
                onToggleFilterType={(value) =>
                    setFilterType((current) => (current === value ? null : value))
                }
                onToggleLiveMode={() => setLiveMode((current) => !current)}
                search={search}
            />

            {errorMessage ? (
                <div className="border-terminal-red/20 border-b bg-terminal-red/10 px-3 py-2 text-terminal-red text-xs">
                    {errorMessage}
                </div>
            ) : null}

            {pendingHeadLogs.length > 0 ? (
                <div className="border-terminal-green/20 border-b bg-terminal-green/10 px-3 py-2 text-terminal-green text-xs">
                    <button
                        className="cursor-pointer hover:underline"
                        onClick={applyPendingHeadLogs}
                        type="button"
                    >
                        {pendingHeadLogs.length} new log
                        {pendingHeadLogs.length === 1 ? '' : 's'} available. Click to load.
                    </button>
                </div>
            ) : null}

            <div className="flex-1 overflow-auto" ref={scrollViewportRef}>
                {logsContent}
            </div>

            <LogsDetailPanel onClose={() => setSelectedLog(null)} selectedLog={selectedLog} />
        </div>
    );
}

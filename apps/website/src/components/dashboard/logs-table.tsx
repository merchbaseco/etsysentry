import type { MutableRefObject } from 'react';
import { StatusBadge } from '@/components/ui/dashboard';
import type { EventLogItem } from '@/lib/logs-api';
import { cn } from '@/lib/utils';
import { formatLogTime, getTargetLabel, LogLevelBadge, PrimitiveTypeBadge } from './logs-ui';

interface LogsTableProps {
    hasMore: boolean;
    isLoadingMore: boolean;
    items: EventLogItem[];
    loadMoreTriggerRef: MutableRefObject<HTMLDivElement | null>;
    onSelectLog: (item: EventLogItem) => void;
}

export function LogsTable(props: LogsTableProps) {
    let loadMoreMessage = 'Start of log history';
    if (props.isLoadingMore) {
        loadMoreMessage = 'Loading more logs...';
    } else if (props.hasMore) {
        loadMoreMessage = 'Scroll for older logs';
    }

    return (
        <>
            <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-border border-b">
                        <th className="w-px whitespace-nowrap px-3 py-2 text-left align-middle text-[10px] text-muted-foreground uppercase tracking-wider">
                            Time
                        </th>
                        <th className="w-px whitespace-nowrap px-2 py-2 text-left align-middle text-[10px] text-muted-foreground uppercase tracking-wider">
                            Level
                        </th>
                        <th className="px-2 py-2 text-left align-middle text-[10px] text-muted-foreground uppercase tracking-wider">
                            Action
                        </th>
                        <th className="w-px whitespace-nowrap px-2 py-2 text-right align-middle text-[10px] text-muted-foreground uppercase tracking-wider">
                            Type
                        </th>
                        <th className="w-px whitespace-nowrap px-2 py-2 text-right align-middle text-[10px] text-muted-foreground uppercase tracking-wider">
                            Target
                        </th>
                        <th className="w-px whitespace-nowrap px-2 py-2 text-right align-middle text-[10px] text-muted-foreground uppercase tracking-wider">
                            Message
                        </th>
                        <th className="w-px whitespace-nowrap px-2 py-2 text-right align-middle text-[10px] text-muted-foreground uppercase tracking-wider">
                            Run ID
                        </th>
                        <th className="w-px whitespace-nowrap px-2 py-2 text-right align-middle text-[10px] text-muted-foreground uppercase tracking-wider">
                            Status
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {props.items.map((logItem) => (
                        <tr
                            className={cn(
                                'cursor-pointer border-border/50 border-b transition-colors hover:bg-accent/50',
                                logItem.level === 'error' && 'bg-terminal-red/3',
                                logItem.level === 'warn' && 'bg-terminal-yellow/3'
                            )}
                            data-row-id={logItem.id}
                            key={logItem.id}
                            onClick={() => props.onSelectLog(logItem)}
                        >
                            <td className="w-px whitespace-nowrap px-3 py-1 align-middle font-mono text-terminal-dim">
                                {formatLogTime(logItem.occurredAt)}
                            </td>
                            <td className="w-px whitespace-nowrap px-2 py-1 align-middle">
                                <LogLevelBadge level={logItem.level} />
                            </td>
                            <td className="px-2 py-1 align-middle font-mono text-foreground">
                                {logItem.action}
                            </td>
                            <td className="w-px whitespace-nowrap px-2 py-1 text-right align-middle">
                                <PrimitiveTypeBadge type={logItem.primitiveType} />
                            </td>
                            <td className="w-px whitespace-nowrap px-2 py-1 text-right align-middle font-mono text-terminal-dim">
                                {getTargetLabel(logItem)}
                            </td>
                            <td className="max-w-64 truncate px-2 py-1 text-right align-middle text-secondary-foreground">
                                {logItem.message}
                            </td>
                            <td className="w-px whitespace-nowrap px-2 py-1 text-right align-middle font-mono text-terminal-dim">
                                {logItem.monitorRunId ?? '--'}
                            </td>
                            <td className="w-px whitespace-nowrap px-2 py-1 text-right align-middle">
                                <StatusBadge status={logItem.status} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div
                className="px-3 py-2 text-center text-[10px] text-muted-foreground"
                ref={props.loadMoreTriggerRef}
            >
                {loadMoreMessage}
            </div>
        </>
    );
}

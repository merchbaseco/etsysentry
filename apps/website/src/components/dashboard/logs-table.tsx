import type { MutableRefObject } from 'react';
import type { EventLogItem } from '@/lib/logs-api';
import { cn } from '@/lib/utils';
import {
    LogLevelBadge,
    PrimitiveTypeBadge,
    formatLogTime,
    getTargetLabel
} from './logs-ui';
import { StatusBadge } from '@/components/ui/dashboard';

type LogsTableProps = {
    hasMore: boolean;
    isLoadingMore: boolean;
    items: EventLogItem[];
    loadMoreTriggerRef: MutableRefObject<HTMLDivElement | null>;
    onSelectLog: (item: EventLogItem) => void;
};

export function LogsTable(props: LogsTableProps) {
    return (
        <>
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
                    {props.items.map((logItem) => (
                        <tr
                            key={logItem.id}
                            data-row-id={logItem.id}
                            onClick={() => props.onSelectLog(logItem)}
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
            <div ref={props.loadMoreTriggerRef} className="px-3 py-2 text-center text-[10px] text-muted-foreground">
                {props.isLoadingMore
                    ? 'Loading more logs...'
                    : props.hasMore
                      ? 'Scroll for older logs'
                      : 'Start of log history'}
            </div>
        </>
    );
}

'use client';

import type {
    EventLogItem,
    EventLogLevel,
    EventLogPrimitiveType,
    EventLogStatus,
} from '@/lib/logs-api';
import { cn } from '@/lib/utils';

export const LOG_LEVELS: EventLogLevel[] = ['info', 'warn', 'error', 'debug'];
export const LOG_STATUSES: EventLogStatus[] = [
    'success',
    'failed',
    'retrying',
    'pending',
    'partial',
];
export const LOG_TYPES: EventLogPrimitiveType[] = ['listing', 'keyword', 'shop', 'system'];

export const toDetailValue = (value: unknown): string => {
    if (value === null || value === undefined) {
        return '--';
    }

    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    return JSON.stringify(value);
};

export const formatLogTime = (dateStr: string): string => {
    const date = new Date(dateStr);

    return date.toLocaleString('en-US', {
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
        minute: '2-digit',
        month: 'short',
        second: '2-digit',
    });
};

export const getTargetLabel = (log: EventLogItem): string => {
    if (log.primitiveType === 'keyword') {
        return log.keyword ?? log.primitiveId ?? '--';
    }

    if (log.primitiveType === 'listing') {
        return log.listingId ?? log.primitiveId ?? '--';
    }

    if (log.primitiveType === 'shop') {
        return log.shopId ?? log.primitiveId ?? '--';
    }

    return log.primitiveId ?? 'system';
};

export function LogLevelBadge({ level }: { level: EventLogLevel }) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded px-1.5 py-0.5 font-bold text-[10px] uppercase tracking-wider',
                level === 'info' && 'text-terminal-blue',
                level === 'warn' && 'text-terminal-yellow',
                level === 'error' && 'text-terminal-red',
                level === 'debug' && 'text-terminal-dim'
            )}
        >
            {level}
        </span>
    );
}

export function PrimitiveTypeBadge({ type }: { type: EventLogPrimitiveType }) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded px-1 py-0.5 text-[10px] uppercase tracking-wider',
                type === 'listing' && 'bg-terminal-green/5 text-terminal-green',
                type === 'keyword' && 'bg-terminal-blue/5 text-terminal-blue',
                type === 'shop' && 'bg-terminal-yellow/5 text-terminal-yellow',
                type === 'system' && 'bg-secondary text-terminal-dim'
            )}
        >
            {type}
        </span>
    );
}

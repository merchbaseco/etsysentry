import { cn } from '@/lib/utils';

const STATUS_DOT_CLASS: Record<string, string> = {
    active: 'bg-terminal-green',
    paused: 'bg-terminal-yellow',
    error: 'bg-terminal-red',
    fatal: 'bg-terminal-red',
    pending: 'bg-terminal-blue',
    success: 'bg-terminal-green',
    failed: 'bg-terminal-red',
    retrying: 'bg-terminal-yellow',
    partial: 'bg-terminal-yellow',
    idle: 'bg-terminal-dim',
    queued: 'bg-terminal-blue',
    syncing: 'bg-terminal-blue'
};

const STATUS_BADGE_CLASS: Record<string, string> = {
    active: 'bg-terminal-green/10 text-terminal-green',
    paused: 'bg-terminal-yellow/10 text-terminal-yellow',
    error: 'bg-terminal-red/10 text-terminal-red',
    fatal: 'bg-terminal-red/10 text-terminal-red',
    pending: 'bg-terminal-blue/10 text-terminal-blue',
    success: 'bg-terminal-green/10 text-terminal-green',
    failed: 'bg-terminal-red/10 text-terminal-red',
    retrying: 'bg-terminal-yellow/10 text-terminal-yellow',
    partial: 'bg-terminal-yellow/10 text-terminal-yellow',
    idle: 'bg-secondary text-terminal-dim',
    queued: 'bg-terminal-blue/10 text-terminal-blue',
    syncing: 'bg-terminal-blue/10 text-terminal-blue'
};

export function StatusDot({ status }: { status: string }) {
    return (
        <span
            className={cn(
                'inline-block size-1.5 rounded-full',
                STATUS_DOT_CLASS[status] ?? STATUS_DOT_CLASS.pending
            )}
        />
    );
}

export function StatusBadge({ status }: { status: string }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] uppercase',
                'tracking-wider font-medium',
                STATUS_BADGE_CLASS[status] ?? STATUS_BADGE_CLASS.pending
            )}
        >
            <StatusDot status={status} />
            {status}
        </span>
    );
}

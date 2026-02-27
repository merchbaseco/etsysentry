import { useQuery } from '@tanstack/react-query';
import { Activity, ShoppingCart } from 'lucide-react';
import type { EtsyOAuthConnectionState } from '@/hooks/use-etsy-oauth-connection';
import { trpc } from '@/lib/trpc-client';
import { cn } from '@/lib/utils';

export const getConnectionLabel = (connection: EtsyOAuthConnectionState): string => {
    if (connection.isCheckingStatus) {
        return 'Checking';
    }

    if (connection.connected && connection.needsRefresh) {
        return 'Refresh Needed';
    }

    if (connection.connected) {
        return 'Connected';
    }

    if (connection.hasSession) {
        return 'Pending';
    }

    return 'Disconnected';
};

export const getConnectionColorClass = (connection: EtsyOAuthConnectionState): string => {
    if (connection.connected && !connection.needsRefresh) {
        return 'text-terminal-green';
    }

    if (connection.connected && connection.needsRefresh) {
        return 'text-terminal-yellow';
    }

    if (connection.hasSession) {
        return 'text-terminal-blue';
    }

    return 'text-terminal-red';
};

const getConnectionBgClass = (connection: EtsyOAuthConnectionState): string => {
    if (connection.connected && !connection.needsRefresh) {
        return 'bg-terminal-green/10';
    }

    if (connection.connected && connection.needsRefresh) {
        return 'bg-terminal-yellow/10';
    }

    if (connection.hasSession) {
        return 'bg-terminal-blue/10';
    }

    return 'bg-terminal-red/10';
};

const getPingColorClass = (connection: EtsyOAuthConnectionState): string => {
    if (connection.connected && !connection.needsRefresh) {
        return 'bg-terminal-green';
    }

    if (connection.connected && connection.needsRefresh) {
        return 'bg-terminal-yellow';
    }

    if (connection.hasSession) {
        return 'bg-terminal-blue';
    }

    return 'bg-terminal-red';
};

export const formatExpirySummary = (expiresAt: string | null): string => {
    if (!expiresAt) {
        return 'N/A';
    }

    const parsed = new Date(expiresAt);

    if (Number.isNaN(parsed.getTime())) {
        return 'N/A';
    }

    return parsed.toLocaleTimeString();
};

const dashboardSummaryQueryOptions = trpc.app.dashboard.getSummary.queryOptions({});

export const StatusIndicator = ({ connection }: { connection: EtsyOAuthConnectionState }) => {
    const connectionLabel = getConnectionLabel(connection);
    const { data: summary } = useQuery({
        ...dashboardSummaryQueryOptions,
        refetchInterval: 60_000,
    });

    const apiCallsPastHour = summary?.etsyApiCallsPastHour ?? '--';
    const apiCallsPast24Hours = summary?.etsyApiCallsPast24Hours ?? '--';
    const trackedListingsTotal = summary?.totalTrackedListings ?? '--';
    const pingColor = getPingColorClass(connection);

    return (
        <div className="flex items-center gap-1.5 text-[10px]">
            <span
                className={cn(
                    'inline-flex items-center gap-1.5 rounded px-1.5 py-0.5',
                    'font-medium uppercase tracking-wider',
                    getConnectionBgClass(connection),
                    getConnectionColorClass(connection)
                )}
            >
                <span className="relative flex size-1.5">
                    <span
                        className={cn(
                            'absolute inline-flex size-full animate-ping rounded-full opacity-75',
                            pingColor
                        )}
                    />
                    <span className={cn('relative inline-flex size-1.5 rounded-full', pingColor)} />
                </span>
                {connectionLabel}
            </span>

            <span
                className={cn(
                    'inline-flex items-center gap-1.5 rounded px-1.5 py-0.5',
                    'bg-secondary text-muted-foreground'
                )}
            >
                <Activity className="size-2.5 text-terminal-dim" />
                <span className="text-terminal-dim uppercase tracking-wider">syncs</span>
                <span className="text-terminal-dim uppercase tracking-wider">1h</span>
                <span className="text-foreground">{apiCallsPastHour}</span>
                <span className="text-terminal-dim">/</span>
                <span className="text-terminal-dim uppercase tracking-wider">24h</span>
                <span className="text-foreground">{apiCallsPast24Hours}</span>
            </span>

            <span
                className={cn(
                    'inline-flex items-center gap-1.5 rounded px-1.5 py-0.5',
                    'bg-secondary text-muted-foreground'
                )}
            >
                <ShoppingCart className="size-2.5 text-terminal-dim" />
                <span className="text-terminal-green">{trackedListingsTotal}</span>
                <span className="text-terminal-dim uppercase tracking-wider">tracked products</span>
            </span>
        </div>
    );
};

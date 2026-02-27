import { CheckCircle2, KeyRound, Link2, RefreshCw, Unplug, Wifi, WifiOff } from 'lucide-react';
import type { EtsyOAuthConnectionState } from '@/hooks/use-etsy-oauth-connection';
import type { RealtimeWebsocketState } from '@/hooks/use-realtime-query-invalidations';
import type { GetListingRefreshPolicyOutput } from '@/lib/listings-api';
import { cn } from '@/lib/utils';
import {
    dataRowClassName,
    formatTimestamp,
    sectionBarClassName,
    sectionBarLabelClassName,
    wideButtonClassName,
    wideDangerButtonClassName
} from '@/components/settings/shared';

const getConnectionStatusLabel = (connection: EtsyOAuthConnectionState): string => {
    if (connection.connected && connection.needsRefresh) {
        return 'Connected (refresh recommended)';
    }

    if (connection.connected) {
        return 'Connected';
    }

    if (connection.hasSession) {
        return 'Session pending';
    }

    return 'Disconnected';
};

const getRealtimeStatusLabel = (realtime: RealtimeWebsocketState): string => {
    if (realtime.status === 'connected') {
        return 'Connected';
    }

    if (realtime.status === 'reconnecting') {
        return `Reconnecting (${realtime.reconnectAttempt})`;
    }

    if (realtime.status === 'connecting') {
        return 'Connecting';
    }

    if (realtime.status === 'waiting_for_auth') {
        return 'Waiting for auth';
    }

    if (realtime.status === 'error') {
        return 'Connection error';
    }

    return 'Disconnected';
};

const getRealtimeStatusClassName = (realtime: RealtimeWebsocketState): string => {
    if (realtime.status === 'connected') {
        return 'bg-terminal-green/10 text-terminal-green';
    }

    if (realtime.status === 'error') {
        return 'bg-terminal-red/10 text-terminal-red';
    }

    if (realtime.status === 'waiting_for_auth') {
        return 'bg-terminal-blue/10 text-terminal-blue';
    }

    return 'bg-terminal-yellow/10 text-terminal-yellow';
};

const refreshPolicyTableRowClassName =
    'grid grid-cols-[1.4fr_2fr_auto] gap-2 border-b border-border/50 px-4 py-1.5';

type EtsyApiSettingsPageProps = {
    connection: EtsyOAuthConnectionState;
    isLoadingListingRefreshPolicy: boolean;
    listingRefreshPolicy: GetListingRefreshPolicyOutput | null;
    listingRefreshPolicyErrorMessage: string | null;
    onRefreshListingRefreshPolicy: () => Promise<void>;
    realtime: RealtimeWebsocketState;
};

export const EtsyApiSettingsPage = ({
    connection,
    isLoadingListingRefreshPolicy,
    listingRefreshPolicy,
    listingRefreshPolicyErrorMessage,
    onRefreshListingRefreshPolicy,
    realtime
}: EtsyApiSettingsPageProps) => {
    const isActionBusy =
        connection.isCheckingStatus ||
        connection.isConnecting ||
        connection.isDisconnecting ||
        connection.isRefreshing;

    return (
        <div>
            <div className={sectionBarClassName}>
                <div className="flex items-center gap-2">
                    <KeyRound className="size-3 text-terminal-blue" />
                    <span className={sectionBarLabelClassName}>OAuth Connection</span>
                </div>
                <span
                    className={cn(
                        'rounded px-1.5 py-0.5 text-xs font-medium',
                        'uppercase tracking-wider',
                        connection.connected
                            ? 'bg-terminal-green/10 text-terminal-green'
                            : 'bg-terminal-yellow/10 text-terminal-yellow'
                    )}
                >
                    {getConnectionStatusLabel(connection)}
                </span>
            </div>

            <div className={dataRowClassName}>
                <span className="text-xs text-muted-foreground">Session</span>
                <span className="text-xs font-medium text-foreground">
                    {connection.sessionLabel ?? 'N/A'}
                </span>
            </div>
            <div className={dataRowClassName}>
                <span className="text-xs text-muted-foreground">Expires</span>
                <span className="text-xs font-medium text-foreground">
                    {formatTimestamp(connection.expiresAt)}
                </span>
            </div>
            <div className={cn(dataRowClassName, 'border-b-0')}>
                <span className="text-xs text-muted-foreground">Scopes</span>
                <span className="text-xs font-medium text-foreground">
                    {connection.scopes.length}
                </span>
            </div>

            <div className="grid grid-cols-2 border-t border-border">
                <button
                    type="button"
                    className={cn(wideButtonClassName, 'border-r')}
                    disabled={isActionBusy}
                    onClick={() => {
                        void connection.connect();
                    }}
                >
                    <Link2 className="size-3" />
                    {connection.hasSession ? 'Reconnect' : 'Connect'}
                </button>
                <button
                    type="button"
                    className={wideButtonClassName}
                    disabled={isActionBusy || !connection.connected}
                    onClick={() => {
                        void connection.refreshConnection();
                    }}
                >
                    <RefreshCw
                        className={cn(
                            'size-3',
                            connection.isRefreshing ? 'animate-spin' : undefined
                        )}
                    />
                    Refresh Token
                </button>
            </div>
            <div className="grid grid-cols-2">
                <button
                    type="button"
                    className={cn(wideButtonClassName, 'border-r')}
                    disabled={isActionBusy}
                    onClick={() => {
                        void connection.checkStatus();
                    }}
                >
                    <CheckCircle2 className="size-3" />
                    Check Status
                </button>
                <button
                    type="button"
                    className={wideDangerButtonClassName}
                    disabled={isActionBusy || !connection.connected}
                    onClick={() => {
                        void connection.forgetSession();
                    }}
                >
                    <Unplug className="size-3" />
                    Forget Session
                </button>
            </div>

            {connection.errorMessage ? (
                <div className="px-4 py-1.5">
                    <p className="text-xs text-terminal-red">
                        {connection.errorMessage}
                    </p>
                </div>
            ) : null}

            <div className={sectionBarClassName}>
                <div className="flex items-center gap-2">
                    {realtime.status === 'connected' ? (
                        <Wifi className="size-3 text-terminal-green" />
                    ) : (
                        <WifiOff className="size-3 text-terminal-yellow" />
                    )}
                    <span className={sectionBarLabelClassName}>Realtime</span>
                </div>
                <span
                    className={cn(
                        'rounded px-1.5 py-0.5 text-xs font-medium',
                        'uppercase tracking-wider',
                        getRealtimeStatusClassName(realtime)
                    )}
                >
                    {getRealtimeStatusLabel(realtime)}
                </span>
            </div>

            {realtime.lastConnectedAt ? (
                <div className={dataRowClassName}>
                    <span className="text-xs text-muted-foreground">Last connected</span>
                    <span className="text-xs font-medium text-foreground">
                        {formatTimestamp(realtime.lastConnectedAt)}
                    </span>
                </div>
            ) : null}
            {realtime.lastErrorAt ? (
                <div className={dataRowClassName}>
                    <span className="text-xs text-muted-foreground">Last error</span>
                    <span className="text-xs font-medium text-terminal-red">
                        {formatTimestamp(realtime.lastErrorAt)}
                    </span>
                </div>
            ) : null}

            <div className={sectionBarClassName}>
                <span className={sectionBarLabelClassName}>Listing Refresh</span>
                <span className="font-mono text-xs text-muted-foreground">
                    {listingRefreshPolicy
                        ? `${listingRefreshPolicy.queuedCount} queued  ` +
                          `${listingRefreshPolicy.autoEnqueueCount} auto`
                        : 'N/A'}
                </span>
            </div>

            <div className={refreshPolicyTableRowClassName}>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Bucket
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Policy
                </span>
                <span
                    className={cn(
                        'text-[10px] text-right uppercase tracking-wider',
                        'text-muted-foreground'
                    )}
                >
                    Count
                </span>
            </div>

            {listingRefreshPolicy?.buckets.length ? (
                listingRefreshPolicy.buckets.map((bucket) => (
                    <div
                        key={bucket.bucketId}
                        className={refreshPolicyTableRowClassName}
                    >
                        <span className="text-xs text-foreground">{bucket.bucket}</span>
                        <span className="text-xs text-muted-foreground">{bucket.policy}</span>
                        <span className="font-mono text-xs text-right text-terminal-green">
                            {bucket.count.toLocaleString()}
                        </span>
                    </div>
                ))
            ) : (
                <div className="border-b border-border/50 px-4 py-1.5">
                    <span className="text-xs text-muted-foreground">
                        {isLoadingListingRefreshPolicy
                            ? 'Loading listing refresh policy...'
                            : 'No listing refresh policy data yet.'}
                    </span>
                </div>
            )}

            <button
                type="button"
                className={wideButtonClassName}
                disabled={isLoadingListingRefreshPolicy}
                onClick={() => {
                    void onRefreshListingRefreshPolicy();
                }}
            >
                <RefreshCw
                    className={cn(
                        'size-3',
                        isLoadingListingRefreshPolicy ? 'animate-spin' : undefined
                    )}
                />
                Refresh Policy
            </button>

            {listingRefreshPolicyErrorMessage ? (
                <div className="px-4 py-1.5">
                    <p className="text-xs text-terminal-red">{listingRefreshPolicyErrorMessage}</p>
                </div>
            ) : null}
        </div>
    );
};

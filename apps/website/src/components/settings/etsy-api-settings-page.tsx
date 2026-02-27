import { CheckCircle2, KeyRound, Link2, RefreshCw, Unplug, Wifi, WifiOff } from 'lucide-react';
import {
    dataRowClassName,
    formatTimestamp,
    sectionBarClassName,
    sectionBarLabelClassName,
    wideButtonClassName,
    wideDangerButtonClassName,
} from '@/components/settings/shared';
import type { EtsyOAuthConnectionState } from '@/hooks/use-etsy-oauth-connection';
import type { RealtimeWebsocketState } from '@/hooks/use-realtime-query-invalidations';
import { cn } from '@/lib/utils';

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

interface EtsyApiSettingsPageProps {
    connection: EtsyOAuthConnectionState;
    realtime: RealtimeWebsocketState;
}

export const EtsyApiSettingsPage = ({ connection, realtime }: EtsyApiSettingsPageProps) => {
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
                        'rounded px-1.5 py-0.5 font-medium text-xs',
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
                <span className="text-muted-foreground text-xs">Session</span>
                <span className="font-medium text-foreground text-xs">
                    {connection.sessionLabel ?? 'N/A'}
                </span>
            </div>
            <div className={dataRowClassName}>
                <span className="text-muted-foreground text-xs">Expires</span>
                <span className="font-medium text-foreground text-xs">
                    {formatTimestamp(connection.expiresAt)}
                </span>
            </div>
            <div className={cn(dataRowClassName, 'border-b-0')}>
                <span className="text-muted-foreground text-xs">Scopes</span>
                <span className="font-medium text-foreground text-xs">
                    {connection.scopes.length}
                </span>
            </div>

            <div className="grid grid-cols-2 border-border border-t">
                <button
                    className={cn(wideButtonClassName, 'border-r')}
                    disabled={isActionBusy}
                    onClick={() => {
                        connection.connect();
                    }}
                    type="button"
                >
                    <Link2 className="size-3" />
                    {connection.hasSession ? 'Reconnect' : 'Connect'}
                </button>
                <button
                    className={wideButtonClassName}
                    disabled={isActionBusy || !connection.connected}
                    onClick={() => {
                        connection.refreshConnection();
                    }}
                    type="button"
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
                    className={cn(wideButtonClassName, 'border-r')}
                    disabled={isActionBusy}
                    onClick={() => {
                        connection.checkStatus();
                    }}
                    type="button"
                >
                    <CheckCircle2 className="size-3" />
                    Check Status
                </button>
                <button
                    className={wideDangerButtonClassName}
                    disabled={isActionBusy || !connection.connected}
                    onClick={() => {
                        connection.forgetSession();
                    }}
                    type="button"
                >
                    <Unplug className="size-3" />
                    Forget Session
                </button>
            </div>

            {connection.errorMessage ? (
                <div className="px-4 py-1.5">
                    <p className="text-terminal-red text-xs">{connection.errorMessage}</p>
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
                        'rounded px-1.5 py-0.5 font-medium text-xs',
                        'uppercase tracking-wider',
                        getRealtimeStatusClassName(realtime)
                    )}
                >
                    {getRealtimeStatusLabel(realtime)}
                </span>
            </div>

            {realtime.lastConnectedAt ? (
                <div className={dataRowClassName}>
                    <span className="text-muted-foreground text-xs">Last connected</span>
                    <span className="font-medium text-foreground text-xs">
                        {formatTimestamp(realtime.lastConnectedAt)}
                    </span>
                </div>
            ) : null}
            {realtime.lastErrorAt ? (
                <div className={dataRowClassName}>
                    <span className="text-muted-foreground text-xs">Last error</span>
                    <span className="font-medium text-terminal-red text-xs">
                        {formatTimestamp(realtime.lastErrorAt)}
                    </span>
                </div>
            ) : null}
        </div>
    );
};

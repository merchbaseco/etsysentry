import type { EtsyOAuthConnectionState } from '@/hooks/use-etsy-oauth-connection';
import { cn } from '@/lib/utils';
import { CheckCircle2, Link2, RefreshCw, ShieldAlert, ShieldCheck, Unplug } from 'lucide-react';

type EtsyApiConnectionPanelProps = {
    connection: EtsyOAuthConnectionState;
};

const formatTimestamp = (value: string | null): string => {
    if (!value) {
        return 'N/A';
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        return 'N/A';
    }

    return parsed.toLocaleString();
};

const getStatusLabel = (connection: EtsyOAuthConnectionState): string => {
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

export const EtsyApiConnectionPanel = ({ connection }: EtsyApiConnectionPanelProps) => {
    const isActionBusy =
        connection.isCheckingStatus || connection.isConnecting || connection.isRefreshing;
    const buttonClassName =
        'inline-flex cursor-pointer items-center gap-1.5 rounded border border-border bg-card ' +
        'px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-foreground ' +
        'transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-default ' +
        'disabled:opacity-50';
    const dangerButtonClassName =
        'inline-flex cursor-pointer items-center gap-1.5 rounded border border-border bg-card ' +
        'px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-terminal-red ' +
        'transition-colors hover:border-terminal-red/40 hover:text-terminal-red ' +
        'disabled:cursor-default disabled:opacity-50';

    return (
        <section className="border-b border-border bg-secondary/40 px-4 py-3">
            <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-64 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                        <div
                            className={cn(
                                'flex size-6 items-center justify-center rounded',
                                'border border-border bg-card'
                            )}
                        >
                            {connection.connected ? (
                                <ShieldCheck className="size-3.5 text-terminal-green" />
                            ) : (
                                <ShieldAlert className="size-3.5 text-terminal-yellow" />
                            )}
                        </div>
                        <h2
                            className={cn(
                                'text-xs font-semibold uppercase tracking-wider',
                                'text-foreground'
                            )}
                        >
                            Etsy API Connection
                        </h2>
                        <span
                            className={cn(
                                'rounded px-2 py-0.5 text-[10px]',
                                'font-medium uppercase tracking-wider',
                                connection.connected
                                    ? 'bg-terminal-green/10 text-terminal-green'
                                    : 'bg-terminal-yellow/10 text-terminal-yellow'
                            )}
                        >
                            {getStatusLabel(connection)}
                        </span>
                    </div>

                    <div
                        className={cn(
                            'flex flex-wrap items-center gap-x-4 gap-y-1',
                            'text-[10px] text-muted-foreground'
                        )}
                    >
                        <span>
                            Session:{' '}
                            <span className="text-foreground">
                                {connection.sessionLabel ?? 'None'}
                            </span>
                        </span>
                        <span>
                            Expires:{' '}
                            <span className="text-foreground">
                                {formatTimestamp(connection.expiresAt)}
                            </span>
                        </span>
                        <span>
                            Scopes:{' '}
                            <span className="text-foreground">
                                {connection.scopes.length > 0
                                    ? connection.scopes.join(', ')
                                    : 'None'}
                            </span>
                        </span>
                    </div>

                    {connection.errorMessage ? (
                        <p className="text-[10px] text-terminal-red">{connection.errorMessage}</p>
                    ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        className={buttonClassName}
                        disabled={isActionBusy}
                        onClick={() => {
                            void connection.connect();
                        }}
                    >
                        <Link2 className="size-3" />
                        {connection.hasSession ? 'Reconnect' : 'Connect'}
                    </button>

                    <button
                        className={buttonClassName}
                        disabled={isActionBusy || !connection.hasSession}
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

                    <button
                        className={buttonClassName}
                        disabled={isActionBusy || !connection.hasSession}
                        onClick={() => {
                            void connection.checkStatus();
                        }}
                    >
                        <CheckCircle2 className="size-3" />
                        Check Status
                    </button>

                    <button
                        className={dangerButtonClassName}
                        disabled={isActionBusy || !connection.hasSession}
                        onClick={connection.forgetSession}
                    >
                        <Unplug className="size-3" />
                        Forget Session
                    </button>
                </div>
            </div>
        </section>
    );
};

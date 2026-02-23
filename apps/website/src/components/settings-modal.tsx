import { useState } from 'react';
import { useTheme } from 'next-themes';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
    CheckCircle2,
    Cog,
    Info,
    Key,
    Link2,
    Monitor,
    Moon,
    RefreshCw,
    Settings,
    ShieldAlert,
    ShieldCheck,
    Sun,
    Unplug,
    Wifi,
    WifiOff,
    XIcon,
} from 'lucide-react';
import type { EtsyOAuthConnectionState } from '@/hooks/use-etsy-oauth-connection';
import type { RealtimeWebsocketState } from '@/hooks/use-realtime-query-invalidations';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type SettingsPage = 'general' | 'etsy-api';

type SettingsModalProps = {
    connection: EtsyOAuthConnectionState;
    realtime: RealtimeWebsocketState;
};

const navItems: { id: SettingsPage; label: string; icon: typeof Settings }[] = [
    { id: 'general', label: 'General', icon: Cog },
    { id: 'etsy-api', label: 'Etsy API', icon: Key },
];

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

function GeneralSettingsPage() {
    const { theme, setTheme } = useTheme();

    const themeOptions = [
        { id: 'light', label: 'Light', icon: Sun, description: 'Light background with dark text' },
        { id: 'dark', label: 'Dark', icon: Moon, description: 'Dark background with light text' },
        {
            id: 'system',
            label: 'System',
            icon: Monitor,
            description: 'Follow operating system preference',
        },
    ] as const;

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Appearance
                </h3>
                <p className="mt-1 text-[10px] text-muted-foreground">
                    Customize how EtsySentry looks on your device.
                </p>
            </div>

            <div className="space-y-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-terminal-dim">
                    Theme
                </span>
                <div className="grid grid-cols-3 gap-2">
                    {themeOptions.map((option) => {
                        const Icon = option.icon;
                        const isActive = theme === option.id;

                        return (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => setTheme(option.id)}
                                className={cn(
                                    'flex cursor-pointer flex-col items-center gap-2 rounded border px-3 py-3',
                                    'text-[10px] transition-all',
                                    isActive
                                        ? 'border-primary bg-primary/5 text-primary'
                                        : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
                                )}
                            >
                                <Icon className="size-4" />
                                <span className="font-medium uppercase tracking-wider">
                                    {option.label}
                                </span>
                                <span
                                    className={cn(
                                        'text-center text-[9px] leading-tight',
                                        isActive ? 'text-primary/70' : 'text-terminal-dim'
                                    )}
                                >
                                    {option.description}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="border-t border-border pt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    About
                </h3>
                <p className="mt-1 text-[10px] text-muted-foreground">
                    Application version and system information.
                </p>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between rounded border border-border bg-secondary/40 px-3 py-2">
                    <div className="flex items-center gap-2">
                        <Info className="size-3 text-terminal-dim" />
                        <span className="text-[10px] text-muted-foreground">Version</span>
                    </div>
                    <span className="text-[10px] font-medium text-foreground">0.1.0</span>
                </div>
                <div className="flex items-center justify-between rounded border border-border bg-secondary/40 px-3 py-2">
                    <div className="flex items-center gap-2">
                        <Info className="size-3 text-terminal-dim" />
                        <span className="text-[10px] text-muted-foreground">Platform</span>
                    </div>
                    <span className="text-[10px] font-medium text-foreground">
                        Etsy API v3
                    </span>
                </div>
                <div className="flex items-center justify-between rounded border border-border bg-secondary/40 px-3 py-2">
                    <div className="flex items-center gap-2">
                        <Info className="size-3 text-terminal-dim" />
                        <span className="text-[10px] text-muted-foreground">Monitoring Cadence</span>
                    </div>
                    <span className="text-[10px] font-medium text-foreground">Daily</span>
                </div>
            </div>
        </div>
    );
}

function EtsyApiSettingsPage({
    connection,
    realtime
}: {
    connection: EtsyOAuthConnectionState;
    realtime: RealtimeWebsocketState;
}) {
    const isActionBusy =
        connection.isCheckingStatus ||
        connection.isConnecting ||
        connection.isDisconnecting ||
        connection.isRefreshing;

    const actionButtonClassName =
        'inline-flex cursor-pointer items-center gap-1.5 rounded border border-border bg-card ' +
        'px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider text-foreground ' +
        'transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-default ' +
        'disabled:opacity-50';

    const dangerButtonClassName =
        'inline-flex cursor-pointer items-center gap-1.5 rounded border border-border bg-card ' +
        'px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider text-terminal-red ' +
        'transition-colors hover:border-terminal-red/40 hover:text-terminal-red ' +
        'disabled:cursor-default disabled:opacity-50';

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Etsy API Connection
                </h3>
                <p className="mt-1 text-[10px] text-muted-foreground">
                    Manage your OAuth connection to the Etsy API.
                </p>
            </div>

            <div className="rounded border border-border bg-secondary/40 p-4">
                <div className="flex items-center gap-3">
                    <div
                        className={cn(
                            'flex size-8 items-center justify-center rounded',
                            'border border-border bg-card'
                        )}
                    >
                        {connection.connected ? (
                            <ShieldCheck className="size-4 text-terminal-green" />
                        ) : (
                            <ShieldAlert className="size-4 text-terminal-yellow" />
                        )}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">
                                Connection Status
                            </span>
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
                    </div>
                </div>

                {connection.errorMessage ? (
                    <p className="mt-3 text-[10px] text-terminal-red">
                        {connection.errorMessage}
                    </p>
                ) : null}
            </div>

            <div className="space-y-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-terminal-dim">
                    Session Details
                </span>
                <div className="space-y-1">
                    <div className="flex items-center justify-between rounded border border-border bg-secondary/40 px-3 py-2">
                        <span className="text-[10px] text-muted-foreground">Session ID</span>
                        <span className="text-[10px] font-medium text-foreground">
                            {connection.sessionLabel ?? 'None'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between rounded border border-border bg-secondary/40 px-3 py-2">
                        <span className="text-[10px] text-muted-foreground">Expires</span>
                        <span className="text-[10px] font-medium text-foreground">
                            {formatTimestamp(connection.expiresAt)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between rounded border border-border bg-secondary/40 px-3 py-2">
                        <span className="text-[10px] text-muted-foreground">Scopes</span>
                        <span className="text-[10px] font-medium text-foreground">
                            {connection.scopes.length > 0
                                ? connection.scopes.join(', ')
                                : 'None'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-terminal-dim">
                    Realtime
                </span>
                <div className="space-y-1">
                    <div className="flex items-center justify-between rounded border border-border bg-secondary/40 px-3 py-2">
                        <div className="flex items-center gap-2">
                            {realtime.status === 'connected' ? (
                                <Wifi className="size-3 text-terminal-green" />
                            ) : (
                                <WifiOff className="size-3 text-terminal-yellow" />
                            )}
                            <span className="text-[10px] text-muted-foreground">WebSocket</span>
                        </div>
                        <span
                            className={cn(
                                'rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                                getRealtimeStatusClassName(realtime)
                            )}
                        >
                            {getRealtimeStatusLabel(realtime)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between rounded border border-border bg-secondary/40 px-3 py-2">
                        <span className="text-[10px] text-muted-foreground">Last Connected</span>
                        <span className="text-[10px] font-medium text-foreground">
                            {formatTimestamp(realtime.lastConnectedAt)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between rounded border border-border bg-secondary/40 px-3 py-2">
                        <span className="text-[10px] text-muted-foreground">Last Error</span>
                        <span className="text-[10px] font-medium text-foreground">
                            {formatTimestamp(realtime.lastErrorAt)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="border-t border-border pt-6">
                <span className="text-[10px] font-medium uppercase tracking-wider text-terminal-dim">
                    Actions
                </span>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        className={actionButtonClassName}
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
                        className={actionButtonClassName}
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

                    <button
                        type="button"
                        className={actionButtonClassName}
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
                        className={dangerButtonClassName}
                        disabled={isActionBusy || !connection.connected}
                        onClick={() => {
                            void connection.forgetSession();
                        }}
                    >
                        <Unplug className="size-3" />
                        Forget Session
                    </button>
                </div>
            </div>
        </div>
    );
}

export function SettingsModal({ connection, realtime }: SettingsModalProps) {
    const [open, setOpen] = useState(false);
    const [activePage, setActivePage] = useState<SettingsPage>('general');

    return (
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
            <DialogPrimitive.Trigger asChild>
                <Button variant="ghost" size="icon-sm" className="size-6">
                    <Settings className="size-3.5" />
                    <span className="sr-only">Settings</span>
                </Button>
            </DialogPrimitive.Trigger>

            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay
                    className={cn(
                        'fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]',
                        'data-[state=open]:animate-in data-[state=closed]:animate-out',
                        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
                    )}
                />
                <DialogPrimitive.Content
                    className={cn(
                        'fixed top-[50%] left-[50%] z-50 translate-x-[-50%] translate-y-[-50%]',
                        'w-[900px] max-w-[90vw] h-[600px] max-h-[85vh]',
                        'rounded-lg border border-border bg-background shadow-2xl',
                        'flex flex-col overflow-hidden',
                        'data-[state=open]:animate-in data-[state=closed]:animate-out',
                        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                        'data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98]',
                        'duration-200'
                    )}
                >
                    <DialogPrimitive.Title className="sr-only">Settings</DialogPrimitive.Title>
                    <DialogPrimitive.Description className="sr-only">
                        Application settings and configuration
                    </DialogPrimitive.Description>

                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
                        <div className="flex items-center gap-2">
                            <div className="flex size-5 items-center justify-center rounded bg-primary/10">
                                <Settings className="size-3 text-primary" />
                            </div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                                Settings
                            </span>
                        </div>
                        <DialogPrimitive.Close
                            className={cn(
                                'flex size-6 cursor-pointer items-center justify-center rounded',
                                'text-muted-foreground transition-colors',
                                'hover:bg-secondary hover:text-foreground'
                            )}
                        >
                            <XIcon className="size-3.5" />
                            <span className="sr-only">Close</span>
                        </DialogPrimitive.Close>
                    </div>

                    {/* Body: Sidebar + Content */}
                    <div className="flex min-h-0 flex-1">
                        {/* Sidebar */}
                        <nav className="flex w-[200px] shrink-0 flex-col border-r border-border bg-card p-2">
                            <div className="space-y-0.5">
                                {navItems.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = activePage === item.id;

                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setActivePage(item.id)}
                                            className={cn(
                                                'flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2',
                                                'text-[11px] font-medium transition-colors',
                                                isActive
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                                            )}
                                        >
                                            <Icon className="size-3.5" />
                                            <span className="uppercase tracking-wider">
                                                {item.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-auto border-t border-border pt-2">
                                <span className="px-3 text-[9px] text-terminal-dim">
                                    EtsySentry v0.1.0
                                </span>
                            </div>
                        </nav>

                        {/* Content */}
                        <div className="min-h-0 flex-1 overflow-y-auto p-6">
                            {activePage === 'general' ? (
                                <GeneralSettingsPage />
                            ) : (
                                <EtsyApiSettingsPage connection={connection} realtime={realtime} />
                            )}
                        </div>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

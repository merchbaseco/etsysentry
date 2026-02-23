import { KeywordsTab } from '@/components/dashboard/keywords-tab';
import { ListingsTab } from '@/components/dashboard/listings-tab';
import { LogsTab } from '@/components/dashboard/logs-tab';
import { ShopsTab } from '@/components/dashboard/shops-tab';
import { SettingsModal } from '@/components/settings-modal';
import { ThemeToggle } from '@/components/theme-toggle';
import { useRealtimeQueryInvalidations } from '@/hooks/use-realtime-query-invalidations';
import {
    useEtsyOAuthConnection,
    type EtsyOAuthConnectionState
} from '@/hooks/use-etsy-oauth-connection';
import { cn } from '@/lib/utils';
import { useAuth } from '@clerk/clerk-react';
import { Activity, Clock, Eye, ShoppingCart } from 'lucide-react';
import { useCallback } from 'react';
import {
    Navigate,
    NavLink,
    Outlet,
    RouterProvider,
    createBrowserRouter
} from 'react-router-dom';

const tabs = [
    { id: 'listings', label: 'Listings', icon: ShoppingCart, count: 25, to: '/' },
    { id: 'keywords', label: 'Keywords', icon: Eye, count: 20, to: '/keywords' },
    { id: 'shops', label: 'Shops', icon: Activity, count: 10, to: '/shops' },
    { id: 'logs', label: 'Logs', icon: Clock, count: 100, to: '/logs' }
] as const;

const getConnectionLabel = (connection: EtsyOAuthConnectionState): string => {
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

const getConnectionColorClass = (connection: EtsyOAuthConnectionState): string => {
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

const formatExpirySummary = (expiresAt: string | null): string => {
    if (!expiresAt) {
        return 'N/A';
    }

    const parsed = new Date(expiresAt);

    if (Number.isNaN(parsed.getTime())) {
        return 'N/A';
    }

    return parsed.toLocaleTimeString();
};

function StatusIndicator({ connection }: { connection: EtsyOAuthConnectionState }) {
    const connectionLabel = getConnectionLabel(connection);
    const connectionColorClass = getConnectionColorClass(connection);

    return (
        <div className="flex items-center gap-3 text-[10px]">
            <div className="flex items-center gap-1.5">
                <span className="relative flex size-2">
                    <span
                        className={cn(
                            'absolute inline-flex size-full animate-ping rounded-full opacity-75',
                            connection.connected ? 'bg-terminal-green' : 'bg-terminal-yellow'
                        )}
                    />
                    <span
                        className={cn(
                            'relative inline-flex size-2 rounded-full',
                            connection.connected ? 'bg-terminal-green' : 'bg-terminal-yellow'
                        )}
                    />
                </span>
                <span className={cn('uppercase tracking-wider', connectionColorClass)}>
                    API {connectionLabel}
                </span>
            </div>
            <span className="text-terminal-dim">|</span>
            <span className="text-muted-foreground">
                Session:{' '}
                <span className="text-foreground">{connection.sessionLabel ?? 'None'}</span>
            </span>
            <span className="text-terminal-dim">|</span>
            <span className="text-muted-foreground">
                Expires:{' '}
                <span className="text-foreground">{formatExpirySummary(connection.expiresAt)}</span>
            </span>
            <span className="text-terminal-dim">|</span>
            <span className="text-muted-foreground">
                Monitors: <span className="text-terminal-green">24</span>
                <span className="text-terminal-dim">/</span>
                <span className="text-terminal-yellow">3</span>
                <span className="text-terminal-dim">/</span>
                <span className="text-terminal-red">1</span>
            </span>
        </div>
    );
}

function DashboardShell() {
    const connection = useEtsyOAuthConnection();
    const { getToken } = useAuth();
    const connectionLabel = getConnectionLabel(connection);
    const getAuthToken = useCallback(async () => {
        return (await getToken()) ?? null;
    }, [getToken]);
    const realtime = useRealtimeQueryInvalidations(getAuthToken);

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-background">
            <header
                className={cn(
                    'flex items-center justify-between border-b border-border bg-card px-4 py-2'
                )}
            >
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="flex size-6 items-center justify-center rounded bg-primary">
                            <span className="text-[10px] font-black text-primary-foreground">
                                ES
                            </span>
                        </div>
                        <h1 className="text-sm font-bold tracking-wider text-primary">
                            EtsySentry
                        </h1>
                    </div>
                    <span className="text-border">|</span>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Monitor Dashboard
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <StatusIndicator connection={connection} />
                    <span className="text-border">|</span>
                    <ThemeToggle />
                    <SettingsModal connection={connection} realtime={realtime} />
                </div>
            </header>

            <nav className="flex items-center border-b border-border bg-card px-2">
                {tabs.map((tab) => {
                    const Icon = tab.icon;

                    return (
                        <NavLink
                            key={tab.id}
                            to={tab.to}
                            end={tab.to === '/'}
                            className={({ isActive }) =>
                                cn(
                                    'relative flex cursor-pointer items-center gap-1.5',
                                    'px-4 py-2 text-xs transition-colors',
                                    isActive
                                        ? 'text-primary'
                                        : 'text-muted-foreground hover:text-foreground'
                                )
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <Icon className="size-3.5" />
                                    <span className="font-medium">{tab.label}</span>
                                    <span
                                        className={cn(
                                            'rounded px-1 py-px text-[9px]',
                                            isActive
                                                ? 'bg-primary/15 text-primary'
                                                : 'bg-secondary text-terminal-dim'
                                        )}
                                    >
                                        {tab.count}
                                    </span>
                                    {isActive ? (
                                        <span
                                            className="absolute inset-x-2 bottom-0 h-px bg-primary"
                                        />
                                    ) : null}
                                </>
                            )}
                        </NavLink>
                    );
                })}

                <div className="ml-auto flex items-center gap-4 pr-2 text-[10px]">
                    <div className="flex items-center gap-1.5">
                        <span className="text-terminal-dim uppercase tracking-wider">Active</span>
                        <span className="font-bold text-terminal-green">42</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-terminal-dim uppercase tracking-wider">Paused</span>
                        <span className="font-bold text-terminal-yellow">8</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-terminal-dim uppercase tracking-wider">Errors</span>
                        <span className="font-bold text-terminal-red">3</span>
                    </div>
                </div>
            </nav>

            <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card">
                <div className="min-h-0 flex-1 overflow-hidden">
                    <Outlet />
                </div>
            </main>

            <footer
                className={cn(
                    'flex items-center justify-between border-t border-border',
                    'bg-card px-4 py-1 text-[9px] text-terminal-dim'
                )}
            >
                <div className="flex items-center gap-3">
                    <span>EtsySentry v0.1.0</span>
                    <span>|</span>
                    <span>
                        API:{' '}
                        <span className={getConnectionColorClass(connection)}>
                            {connectionLabel}
                        </span>
                    </span>
                    <span>|</span>
                    <span>
                        Session:{' '}
                        <span className="text-foreground">{connection.sessionLabel ?? 'None'}</span>
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span>
                        Scopes: <span className="text-foreground">{connection.scopes.length}</span>
                    </span>
                    <span>|</span>
                    <span>
                        Expires:{' '}
                        <span className="text-foreground">
                            {formatExpirySummary(connection.expiresAt)}
                        </span>
                    </span>
                    <span>|</span>
                    <span>{new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC</span>
                </div>
            </footer>
        </div>
    );
}

const router = createBrowserRouter([
    {
        path: '/',
        element: <DashboardShell />,
        children: [
            {
                index: true,
                element: (
                    <div className="h-full">
                        <ListingsTab />
                    </div>
                )
            },
            {
                path: 'keywords',
                element: (
                    <div className="h-full">
                        <KeywordsTab />
                    </div>
                )
            },
            {
                path: 'shops',
                element: (
                    <div className="h-full">
                        <ShopsTab />
                    </div>
                )
            },
            {
                path: 'logs',
                element: (
                    <div className="h-full">
                        <LogsTab />
                    </div>
                )
            },
            {
                path: '*',
                element: <Navigate to="/" replace />
            }
        ]
    }
]);

export function App() {
    return <RouterProvider router={router} />;
}

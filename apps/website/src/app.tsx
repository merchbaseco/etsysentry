import { KeywordsTab } from '@/components/dashboard/keywords-tab';
import { ListingsTab } from '@/components/dashboard/listings-tab';
import { LogsTab } from '@/components/dashboard/logs-tab';
import { ShopsTab } from '@/components/dashboard/shops-tab';
import {
    StatusIndicator,
    formatExpirySummary,
    getConnectionColorClass,
    getConnectionLabel
} from '@/components/dashboard/status-indicator';
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
    { id: 'listings', label: 'Listings', icon: ShoppingCart, to: '/' },
    { id: 'keywords', label: 'Keywords', icon: Eye, to: '/keywords' },
    { id: 'shops', label: 'Shops', icon: Activity, to: '/shops' },
    { id: 'logs', label: 'Logs', icon: Clock, to: '/logs' }
] as const;

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
                <div className="flex items-center gap-2">
                    <StatusIndicator connection={connection} />
                    <span className="mx-0.5 text-border">|</span>
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

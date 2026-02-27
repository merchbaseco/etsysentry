import { useAuth } from '@clerk/clerk-react';
import { Activity, Briefcase, Clock, Eye, ShoppingCart } from 'lucide-react';
import { useCallback } from 'react';
import { createBrowserRouter, Navigate, NavLink, Outlet, RouterProvider } from 'react-router-dom';
import { KeywordsTab } from '@/components/dashboard/keywords-tab';
import { ListingsTab } from '@/components/dashboard/listings-tab';
import { LogsTab } from '@/components/dashboard/logs-tab';
import { ShopsTab } from '@/components/dashboard/shops-tab';
import { StatusIndicator } from '@/components/dashboard/status-indicator';
import { SummaryCount } from '@/components/dashboard/summary-count';
import { SettingsModal } from '@/components/settings-modal';
import { ThemeToggle } from '@/components/theme-toggle';
import { useDashboardSummaryQuery } from '@/hooks/use-dashboard-summary-query';
import { useEtsyOAuthConnection } from '@/hooks/use-etsy-oauth-connection';
import { useRealtimeQueryInvalidations } from '@/hooks/use-realtime-query-invalidations';
import { cn } from '@/lib/utils';

const tabs = [
    { id: 'listings', label: 'Listings', icon: ShoppingCart, to: '/' },
    { id: 'keywords', label: 'Keywords', icon: Eye, to: '/keywords' },
    { id: 'shops', label: 'Shops', icon: Activity, to: '/shops' },
    { id: 'logs', label: 'Logs', icon: Clock, to: '/logs' },
] as const;
const DashboardJobsSummary = () => {
    const { data, isPending } = useDashboardSummaryQuery();
    const queuedJobs = data?.queuedJobs;
    const inFlightJobs = data?.inFlightJobs;
    const hasActive =
        (typeof inFlightJobs === 'number' && inFlightJobs > 0) ||
        (typeof queuedJobs === 'number' && queuedJobs > 0);

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded px-1.5 py-0.5',
                hasActive
                    ? 'bg-terminal-blue/10 text-terminal-blue'
                    : 'bg-secondary text-muted-foreground'
            )}
        >
            <Briefcase className="size-2.5 text-terminal-dim" />
            <span className="text-terminal-dim uppercase tracking-wider">jobs</span>
            <SummaryCount
                isLoading={isPending}
                minWidthClassName="min-w-[3ch]"
                skeletonWidthClassName="w-[3ch]"
                value={queuedJobs}
                valueClassName={hasActive ? 'text-terminal-blue' : 'text-foreground'}
            />
            <span className="text-terminal-dim uppercase tracking-wider">queued</span>
            <span className="text-terminal-dim">/</span>
            <SummaryCount
                isLoading={isPending}
                minWidthClassName="min-w-[3ch]"
                skeletonWidthClassName="w-[3ch]"
                value={inFlightJobs}
                valueClassName={hasActive ? 'text-terminal-blue' : 'text-foreground'}
            />
            <span className="text-terminal-dim uppercase tracking-wider">in-flight</span>
        </span>
    );
};

function DashboardShell() {
    const connection = useEtsyOAuthConnection();
    const { getToken } = useAuth();
    const getAuthToken = useCallback(async () => {
        return (await getToken()) ?? null;
    }, [getToken]);
    const realtime = useRealtimeQueryInvalidations(getAuthToken);

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-background">
            <header
                className={cn(
                    'flex items-center justify-between border-border border-b bg-card px-4 py-2'
                )}
            >
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="flex size-6 items-center justify-center rounded bg-primary">
                            <span className="font-black text-[10px] text-primary-foreground">
                                ES
                            </span>
                        </div>
                        <h1 className="font-bold text-primary text-sm tracking-wider">
                            EtsySentry
                        </h1>
                    </div>
                    <span className="text-border">|</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
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

            <nav className="flex items-center border-border border-b bg-card px-2">
                {tabs.map((tab) => {
                    const Icon = tab.icon;

                    return (
                        <NavLink
                            className={({ isActive }) =>
                                cn(
                                    'relative flex cursor-pointer items-center gap-1.5',
                                    'px-4 py-2 text-xs transition-colors',
                                    isActive
                                        ? 'text-primary'
                                        : 'text-muted-foreground hover:text-foreground'
                                )
                            }
                            end={tab.to === '/'}
                            key={tab.id}
                            to={tab.to}
                        >
                            {({ isActive }) => (
                                <>
                                    <Icon className="size-3.5" />
                                    <span className="font-medium">{tab.label}</span>
                                    {isActive ? (
                                        <span className="absolute inset-x-2 bottom-0 h-px bg-primary" />
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
                    'flex items-center justify-end border-border border-t bg-card px-4 py-2',
                    'text-[10px] text-terminal-dim'
                )}
            >
                <div className="flex items-center gap-1.5">
                    <span className="uppercase tracking-wider">EtsySentry v0.1.0</span>
                    <span className="text-border">|</span>
                    <DashboardJobsSummary />
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
                ),
            },
            {
                path: 'keywords',
                element: (
                    <div className="h-full">
                        <KeywordsTab />
                    </div>
                ),
            },
            {
                path: 'shops',
                element: (
                    <div className="h-full">
                        <ShopsTab />
                    </div>
                ),
            },
            {
                path: 'logs',
                element: (
                    <div className="h-full">
                        <LogsTab />
                    </div>
                ),
            },
            {
                path: '*',
                element: <Navigate replace to="/" />,
            },
        ],
    },
]);

export function App() {
    return <RouterProvider router={router} />;
}

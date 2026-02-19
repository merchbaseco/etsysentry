import { cn } from '@/lib/utils';
import { KeywordsTab } from '@/components/dashboard/keywords-tab';
import { ListingsTab } from '@/components/dashboard/listings-tab';
import { LogsTab } from '@/components/dashboard/logs-tab';
import { ShopsTab } from '@/components/dashboard/shops-tab';
import { Activity, Clock, Eye, ShoppingCart } from 'lucide-react';
import {
    Navigate,
    NavLink,
    Outlet,
    RouterProvider,
    createBrowserRouter,
} from 'react-router-dom';

const tabs = [
    { id: 'listings', label: 'Listings', icon: ShoppingCart, count: 25, to: '/' },
    { id: 'keywords', label: 'Keywords', icon: Eye, count: 20, to: '/keywords' },
    { id: 'shops', label: 'Shops', icon: Activity, count: 10, to: '/shops' },
    { id: 'logs', label: 'Logs', icon: Clock, count: 100, to: '/logs' },
] as const;

function StatusIndicator() {
    return (
        <div className="flex items-center gap-3 text-[10px]">
            <div className="flex items-center gap-1.5">
                <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-terminal-green opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-terminal-green" />
                </span>
                <span className="text-terminal-green uppercase tracking-wider">Operational</span>
            </div>
            <span className="text-terminal-dim">|</span>
            <span className="text-muted-foreground">
                Last sync: <span className="text-foreground">2m ago</span>
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
    return (
        <div className="flex h-screen flex-col overflow-hidden bg-background">
            <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="flex size-6 items-center justify-center rounded bg-primary">
                            <span className="text-[10px] font-black text-primary-foreground">ES</span>
                        </div>
                        <h1 className="text-sm font-bold tracking-wider text-primary">EtsySentry</h1>
                    </div>
                    <span className="text-border">|</span>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Monitor Dashboard
                    </span>
                </div>
                <StatusIndicator />
            </header>

            <nav className="flex items-center border-b border-border bg-card px-2">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <NavLink
                            key={tab.id}
                            to={tab.to}
                            end={tab.to === '/'}
                            className={({ isActive }) =>
                                cn(
                                    'relative flex cursor-pointer items-center gap-1.5 px-4 py-2 text-xs transition-colors',
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
                                        <span className="absolute right-2 bottom-0 left-2 h-px bg-primary" />
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

            <main className="flex-1 overflow-hidden bg-card">
                <Outlet />
            </main>

            <footer className="flex items-center justify-between border-t border-border bg-card px-4 py-1 text-[9px] text-terminal-dim">
                <div className="flex items-center gap-3">
                    <span>EtsySentry v0.1.0</span>
                    <span>|</span>
                    <span>
                        API: <span className="text-terminal-green">Connected</span>
                    </span>
                    <span>|</span>
                    <span>
                        Rate Limit: <span className="text-foreground">847</span>/1000
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span>
                        Memory: <span className="text-foreground">124MB</span>
                    </span>
                    <span>|</span>
                    <span>
                        Uptime: <span className="text-foreground">14d 7h 32m</span>
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
                element: <Navigate to="/" replace />,
            },
        ],
    },
]);

export function App() {
    return <RouterProvider router={router} />;
}

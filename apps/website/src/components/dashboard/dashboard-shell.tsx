import { useAuth } from '@clerk/clerk-react';
import { Activity, Briefcase, Clock, Eye, ShoppingCart, Store, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { DashboardTabLink } from '@/components/dashboard/dashboard-tab-link';
import {
    loadShopActivityTabs,
    normalizeShopTabLabel,
    parseShopActivityPath,
    removeShopActivityTab,
    type ShopActivityTab as ShopActivityTabState,
    saveShopActivityTabs,
    toShopActivityPath,
    upsertShopActivityTab,
} from '@/components/dashboard/shop-activity-tabs-state';
import { StatusIndicator } from '@/components/dashboard/status-indicator';
import { SummaryCount } from '@/components/dashboard/summary-count';
import { SettingsModal } from '@/components/settings-modal';
import { ThemeToggle } from '@/components/theme-toggle';
import { useDashboardSummaryQuery } from '@/hooks/use-dashboard-summary-query';
import { useEtsyOAuthConnection } from '@/hooks/use-etsy-oauth-connection';
import { useRealtimeQueryInvalidations } from '@/hooks/use-realtime-query-invalidations';
import { cn } from '@/lib/utils';

const tabsBeforeShop = [
    { id: 'listings', label: 'Listings', icon: ShoppingCart, to: '/' },
    { id: 'keywords', label: 'Keywords', icon: Eye, to: '/keywords' },
    { id: 'shops', label: 'Shops', icon: Activity, to: '/shops' },
] as const;

const tabsAfterShop = [{ id: 'logs', label: 'Logs', icon: Clock, to: '/logs' }] as const;

const isLocationStateRecord = (value: unknown): value is Record<string, unknown> => {
    return value !== null && typeof value === 'object';
};

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

export function DashboardShell() {
    const connection = useEtsyOAuthConnection();
    const location = useLocation();
    const navigate = useNavigate();
    const [shopTabs, setShopTabs] = useState<ShopActivityTabState[]>(() => loadShopActivityTabs());
    const { getToken } = useAuth();
    const getAuthToken = useCallback(async () => {
        return (await getToken()) ?? null;
    }, [getToken]);
    useRealtimeQueryInvalidations(getAuthToken);

    const activeShopActivity = useMemo(() => {
        return parseShopActivityPath(location.pathname);
    }, [location.pathname]);

    const stateShopName = useMemo(() => {
        if (!isLocationStateRecord(location.state)) {
            return null;
        }

        const value = location.state.shopName;

        if (typeof value !== 'string' || value.trim().length === 0) {
            return null;
        }

        return value.trim();
    }, [location.state]);

    useEffect(() => {
        saveShopActivityTabs(shopTabs);
    }, [shopTabs]);

    useEffect(() => {
        if (!activeShopActivity) {
            return;
        }

        const etsyShopId = activeShopActivity.etsyShopId;

        setShopTabs((current) => {
            const existing = current.find((item) => item.etsyShopId === etsyShopId);

            if (existing) {
                if (!stateShopName) {
                    return current;
                }

                return upsertShopActivityTab(current, {
                    etsyShopId,
                    shopName: stateShopName,
                });
            }

            const fallbackLabel = `Shop ${etsyShopId.slice(0, 8)}`;

            return upsertShopActivityTab(current, {
                etsyShopId,
                shopName: normalizeShopTabLabel(stateShopName ?? fallbackLabel),
            });
        });
    }, [activeShopActivity, stateShopName]);

    const closeShopTab = useCallback(
        (etsyShopId: string) => {
            setShopTabs((current) => removeShopActivityTab(current, etsyShopId));

            if (activeShopActivity?.etsyShopId === etsyShopId) {
                navigate('/shops', {
                    replace: true,
                });
            }
        },
        [activeShopActivity, navigate]
    );

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
                    <SettingsModal connection={connection} />
                </div>
            </header>

            <nav className="flex min-w-0 items-center border-border border-b bg-card px-2">
                <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
                    {tabsBeforeShop.map((tab) => (
                        <DashboardTabLink
                            icon={tab.icon}
                            key={tab.id}
                            label={tab.label}
                            to={tab.to}
                        />
                    ))}

                    {shopTabs.length > 0 ? <span className="mx-2 h-4 w-px bg-border" /> : null}

                    {shopTabs.map((tab) => (
                        <div className="relative mr-1 shrink-0" key={tab.etsyShopId}>
                            <NavLink
                                className={({ isActive }) =>
                                    cn(
                                        'relative flex cursor-pointer items-center gap-1.5 px-3 py-2 pr-7 text-xs transition-colors',
                                        isActive
                                            ? 'text-primary'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )
                                }
                                to={toShopActivityPath(tab.etsyShopId)}
                            >
                                {({ isActive }) => (
                                    <>
                                        <Store className="size-3.5" />
                                        <span className="max-w-48 truncate font-medium">
                                            {tab.shopName}
                                        </span>
                                        {isActive ? (
                                            <span className="absolute inset-x-2 bottom-0 h-px bg-primary" />
                                        ) : null}
                                    </>
                                )}
                            </NavLink>
                            <button
                                aria-label={`Close ${tab.shopName}`}
                                className="absolute top-1/2 right-1 inline-flex size-4 -translate-y-1/2 items-center justify-center rounded text-terminal-dim transition-colors hover:bg-secondary hover:text-foreground"
                                onClick={(event) => {
                                    event.preventDefault();
                                    closeShopTab(tab.etsyShopId);
                                }}
                                type="button"
                            >
                                <X className="size-3" />
                            </button>
                        </div>
                    ))}

                    {shopTabs.length > 0 && tabsAfterShop.length > 0 ? (
                        <span className="mx-2 h-4 w-px bg-border" />
                    ) : null}

                    {tabsAfterShop.map((tab) => (
                        <DashboardTabLink
                            icon={tab.icon}
                            key={tab.id}
                            label={tab.label}
                            to={tab.to}
                        />
                    ))}
                </div>
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
                    <span className="uppercase tracking-wider">EtsySentry v0.1.1</span>
                    <span className="text-border">|</span>
                    <DashboardJobsSummary />
                </div>
            </footer>
        </div>
    );
}

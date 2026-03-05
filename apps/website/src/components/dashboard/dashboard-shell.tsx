import { useAuth } from '@clerk/clerk-react';
import { Activity, Clock, Eye, ShoppingCart, Store } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { DashboardActivityTabLink } from '@/components/dashboard/dashboard-activity-tab-link';
import { DashboardJobsSummary } from '@/components/dashboard/dashboard-jobs-summary';
import { DashboardTabLink } from '@/components/dashboard/dashboard-tab-link';
import {
    type KeywordActivityTab as KeywordActivityTabState,
    loadKeywordActivityTabs,
    normalizeKeywordTabLabel,
    parseKeywordActivityPath,
    removeKeywordActivityTab,
    saveKeywordActivityTabs,
    toKeywordActivityPath,
    upsertKeywordActivityTab,
} from '@/components/dashboard/keyword-activity-tabs-state';
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
import { SettingsModal } from '@/components/settings-modal';
import { ThemeToggle } from '@/components/theme-toggle';
import { useEtsyOAuthConnection } from '@/hooks/use-etsy-oauth-connection';
import { useRealtimeQueryInvalidations } from '@/hooks/use-realtime-query-invalidations';
import { cn } from '@/lib/utils';

const tabsBeforeKeyword = [
    { id: 'listings', label: 'Listings', icon: ShoppingCart, to: '/' },
    { id: 'keywords', label: 'Keywords', icon: Eye, to: '/keywords' },
] as const;

const tabsBetweenKeywordAndShop = [
    { id: 'shops', label: 'Shops', icon: Activity, to: '/shops' },
] as const;

const tabsAfterShop = [{ id: 'logs', label: 'Logs', icon: Clock, to: '/logs' }] as const;

const isLocationStateRecord = (value: unknown): value is Record<string, unknown> => {
    return value !== null && typeof value === 'object';
};

export function DashboardShell() {
    const connection = useEtsyOAuthConnection();
    const location = useLocation();
    const navigate = useNavigate();
    const [keywordTabs, setKeywordTabs] = useState<KeywordActivityTabState[]>(() =>
        loadKeywordActivityTabs()
    );
    const [shopTabs, setShopTabs] = useState<ShopActivityTabState[]>(() => loadShopActivityTabs());
    const { getToken } = useAuth();
    const getAuthToken = useCallback(async () => {
        return (await getToken()) ?? null;
    }, [getToken]);
    useRealtimeQueryInvalidations(getAuthToken);

    const activeKeywordActivity = useMemo(() => {
        return parseKeywordActivityPath(location.pathname);
    }, [location.pathname]);
    const activeShopActivity = useMemo(() => {
        return parseShopActivityPath(location.pathname);
    }, [location.pathname]);

    const locationState = useMemo(() => {
        return isLocationStateRecord(location.state) ? location.state : null;
    }, [location.state]);

    const stateKeyword = useMemo(() => {
        const value = locationState?.keyword;

        if (typeof value !== 'string' || value.trim().length === 0) {
            return null;
        }

        return value.trim();
    }, [locationState]);

    const stateShopName = useMemo(() => {
        const value = locationState?.shopName;

        if (typeof value !== 'string' || value.trim().length === 0) {
            return null;
        }

        return value.trim();
    }, [locationState]);

    useEffect(() => {
        saveKeywordActivityTabs(keywordTabs);
    }, [keywordTabs]);

    useEffect(() => {
        saveShopActivityTabs(shopTabs);
    }, [shopTabs]);

    useEffect(() => {
        if (!activeKeywordActivity) {
            return;
        }

        const trackedKeywordId = activeKeywordActivity.trackedKeywordId;

        setKeywordTabs((current) => {
            const existing = current.find((item) => item.trackedKeywordId === trackedKeywordId);

            if (existing) {
                if (!stateKeyword) {
                    return current;
                }

                return upsertKeywordActivityTab(current, {
                    keyword: stateKeyword,
                    trackedKeywordId,
                });
            }

            const fallbackLabel = `Keyword ${trackedKeywordId.slice(0, 8)}`;

            return upsertKeywordActivityTab(current, {
                keyword: normalizeKeywordTabLabel(stateKeyword ?? fallbackLabel),
                trackedKeywordId,
            });
        });
    }, [activeKeywordActivity, stateKeyword]);

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

    const closeKeywordTab = useCallback(
        (trackedKeywordId: string) => {
            setKeywordTabs((current) => removeKeywordActivityTab(current, trackedKeywordId));

            if (activeKeywordActivity?.trackedKeywordId === trackedKeywordId) {
                navigate('/keywords', {
                    replace: true,
                });
            }
        },
        [activeKeywordActivity, navigate]
    );

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
                    {tabsBeforeKeyword.map((tab) => (
                        <DashboardTabLink
                            icon={tab.icon}
                            key={tab.id}
                            label={tab.label}
                            to={tab.to}
                        />
                    ))}

                    {keywordTabs.length > 0 ? <span className="mx-2 h-4 w-px bg-border" /> : null}

                    {keywordTabs.map((tab) => (
                        <DashboardActivityTabLink
                            icon={Eye}
                            id={tab.trackedKeywordId}
                            key={tab.trackedKeywordId}
                            label={tab.keyword}
                            onClose={() => closeKeywordTab(tab.trackedKeywordId)}
                            to={toKeywordActivityPath(tab.trackedKeywordId)}
                        />
                    ))}

                    {tabsBetweenKeywordAndShop.map((tab) => (
                        <DashboardTabLink
                            icon={tab.icon}
                            key={tab.id}
                            label={tab.label}
                            to={tab.to}
                        />
                    ))}

                    {shopTabs.length > 0 ? <span className="mx-2 h-4 w-px bg-border" /> : null}

                    {shopTabs.map((tab) => (
                        <DashboardActivityTabLink
                            icon={Store}
                            id={tab.etsyShopId}
                            key={tab.etsyShopId}
                            label={tab.shopName}
                            onClose={() => closeShopTab(tab.etsyShopId)}
                            to={toShopActivityPath(tab.etsyShopId)}
                        />
                    ))}

                    {tabsAfterShop.length > 0 ? <span className="mx-2 h-4 w-px bg-border" /> : null}

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

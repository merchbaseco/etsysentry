import { useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowDownUp, Cog, Key, Settings, Shield, XIcon } from 'lucide-react';
import { AdminSettingsPage } from '@/components/settings/admin-settings-page';
import { CurrencySettingsPage } from '@/components/settings/currency-settings-page';
import { EtsyApiSettingsPage } from '@/components/settings/etsy-api-settings-page';
import { GeneralSettingsPage } from '@/components/settings/general-settings-page';
import { type SettingsPage } from '@/components/settings/shared';
import { useSettingsModalState } from '@/components/settings/use-settings-modal-state';
import { Button } from '@/components/ui/button';
import type { EtsyOAuthConnectionState } from '@/hooks/use-etsy-oauth-connection';
import type { RealtimeWebsocketState } from '@/hooks/use-realtime-query-invalidations';
import { cn } from '@/lib/utils';

type SettingsModalProps = {
    connection: EtsyOAuthConnectionState;
    realtime: RealtimeWebsocketState;
};

type NavItem = {
    icon: typeof Settings;
    id: SettingsPage;
    label: string;
};

const baseNavItems: NavItem[] = [
    { id: 'general', label: 'General', icon: Cog },
    { id: 'etsy-api', label: 'Etsy API', icon: Key },
    { id: 'currency', label: 'Currency', icon: ArrowDownUp }
];

const adminNavItem: NavItem = { id: 'admin', label: 'Admin', icon: Shield };

export const SettingsModal = ({ connection, realtime }: SettingsModalProps) => {
    const [open, setOpen] = useState(false);
    const [activePage, setActivePage] = useState<SettingsPage>('general');

    const {
        adminErrorMessage,
        adminEnqueueMessage,
        apiUsage,
        apiUsageErrorMessage,
        currencyErrorMessage,
        currencyStatus,
        handleEnqueueListingResync,
        handleRefreshCurrencyRates,
        hasAdminAccess,
        isEnqueuingListingResync,
        isLoadingApiUsage,
        isLoadingCurrencyStatus,
        isLoadingListingRefreshPolicy,
        isRefreshingCurrencyRates,
        listingRefreshPolicy,
        listingRefreshPolicyErrorMessage,
        loadListingRefreshPolicy,
        loadApiUsage
    } = useSettingsModalState({
        activePage,
        open,
        setActivePage
    });

    const navItems = useMemo(() => {
        if (!hasAdminAccess) {
            return baseNavItems;
        }

        return [...baseNavItems, adminNavItem];
    }, [hasAdminAccess]);

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
                        'fixed top-[50%] left-[50%] z-50',
                        'translate-x-[-50%] translate-y-[-50%]',
                        'h-[600px] max-h-[85vh] w-[860px] max-w-[90vw]',
                        'flex flex-col overflow-hidden rounded border border-border',
                        'bg-card',
                        'data-[state=open]:animate-in data-[state=closed]:animate-out',
                        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                        'data-[state=closed]:zoom-out-[0.98]',
                        'data-[state=open]:zoom-in-[0.98]',
                        'duration-200'
                    )}
                >
                    <DialogPrimitive.Title className="sr-only">
                        Settings
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="sr-only">
                        Application settings and configuration
                    </DialogPrimitive.Description>

                    <div className="flex min-h-0 flex-1">
                        <nav
                            className={cn(
                                'flex w-[160px] shrink-0 flex-col',
                                'border-r border-border bg-background'
                            )}
                        >
                            <div className="px-3 py-2.5">
                                <span
                                    className={cn(
                                        'text-[11px] font-semibold uppercase',
                                        'tracking-widest text-terminal-dim'
                                    )}
                                >
                                    Settings
                                </span>
                            </div>

                            <div className="space-y-0.5 px-1.5">
                                {navItems.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = activePage === item.id;

                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setActivePage(item.id)}
                                            className={cn(
                                                'flex w-full cursor-pointer items-center',
                                                'gap-2 rounded px-2.5 py-1.5',
                                                'text-[13px] transition-colors',
                                                isActive
                                                    ? 'bg-secondary font-medium text-foreground'
                                                    : 'text-muted-foreground hover:bg-secondary/50',
                                                !isActive ? 'hover:text-foreground' : ''
                                            )}
                                        >
                                            <Icon className="size-4" />
                                            <span>{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-auto border-t border-border px-3 py-2">
                                <span className="text-[10px] text-terminal-dim">
                                    EtsySentry v0.1.0
                                </span>
                            </div>
                        </nav>

                        <div className="min-h-0 flex-1 overflow-y-auto">
                            <div className="flex items-center justify-between px-4 py-2.5">
                                <h2 className="text-base font-semibold text-foreground">
                                    {navItems.find((n) => n.id === activePage)?.label ??
                                        'Settings'}
                                </h2>
                                <DialogPrimitive.Close
                                    className={cn(
                                        'flex size-6 cursor-pointer items-center',
                                        'justify-center rounded text-muted-foreground',
                                        'transition-colors hover:bg-secondary',
                                        'hover:text-foreground'
                                    )}
                                >
                                    <XIcon className="size-4" />
                                    <span className="sr-only">Close</span>
                                </DialogPrimitive.Close>
                            </div>

                            {activePage === 'general' ? <GeneralSettingsPage /> : null}
                            {activePage === 'etsy-api' ? (
                                <EtsyApiSettingsPage
                                    connection={connection}
                                    isLoadingListingRefreshPolicy={isLoadingListingRefreshPolicy}
                                    listingRefreshPolicy={listingRefreshPolicy}
                                    listingRefreshPolicyErrorMessage={
                                        listingRefreshPolicyErrorMessage
                                    }
                                    onRefreshListingRefreshPolicy={loadListingRefreshPolicy}
                                    realtime={realtime}
                                />
                            ) : null}
                            {activePage === 'currency' ? (
                                <CurrencySettingsPage
                                    errorMessage={currencyErrorMessage}
                                    isLoadingStatus={isLoadingCurrencyStatus}
                                    isRefreshingRates={isRefreshingCurrencyRates}
                                    onRefreshRates={handleRefreshCurrencyRates}
                                    status={currencyStatus}
                                />
                            ) : null}
                            {activePage === 'admin' && hasAdminAccess ? (
                                <AdminSettingsPage
                                    apiUsage={apiUsage}
                                    apiUsageErrorMessage={apiUsageErrorMessage}
                                    enqueueErrorMessage={adminErrorMessage}
                                    enqueueMessage={adminEnqueueMessage}
                                    isEnqueuingListingResync={isEnqueuingListingResync}
                                    isLoadingApiUsage={isLoadingApiUsage}
                                    onEnqueueListingResync={handleEnqueueListingResync}
                                    onRefreshApiUsage={loadApiUsage}
                                />
                            ) : null}
                        </div>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
};

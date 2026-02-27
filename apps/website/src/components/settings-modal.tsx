import {
    Close,
    Content,
    Description,
    Overlay,
    Portal,
    Root,
    Title,
    Trigger,
} from '@radix-ui/react-dialog';
import { ArrowDownUp, Cog, Key, Settings, Shield, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AdminSettingsPage } from '@/components/settings/admin-settings-page';
import { CurrencySettingsPage } from '@/components/settings/currency-settings-page';
import { EtsyApiSettingsPage } from '@/components/settings/etsy-api-settings-page';
import { GeneralSettingsPage } from '@/components/settings/general-settings-page';
import type { SettingsPage } from '@/components/settings/shared';
import { useSettingsModalState } from '@/components/settings/use-settings-modal-state';
import { Button } from '@/components/ui/button';
import type { EtsyOAuthConnectionState } from '@/hooks/use-etsy-oauth-connection';
import type { RealtimeWebsocketState } from '@/hooks/use-realtime-query-invalidations';
import { cn } from '@/lib/utils';

interface SettingsModalProps {
    connection: EtsyOAuthConnectionState;
    realtime: RealtimeWebsocketState;
}

interface NavItem {
    icon: typeof Settings;
    id: SettingsPage;
    label: string;
}

const baseNavItems: NavItem[] = [
    { id: 'general', label: 'General', icon: Cog },
    { id: 'etsy-api', label: 'Etsy API', icon: Key },
    { id: 'currency', label: 'Currency', icon: ArrowDownUp },
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
        isRefreshingCurrencyRates,
        loadApiUsage,
    } = useSettingsModalState({
        activePage,
        open,
        setActivePage,
    });

    const navItems = useMemo(() => {
        if (!hasAdminAccess) {
            return baseNavItems;
        }

        return [...baseNavItems, adminNavItem];
    }, [hasAdminAccess]);

    return (
        <Root onOpenChange={setOpen} open={open}>
            <Trigger asChild>
                <Button className="size-6" size="icon-sm" variant="ghost">
                    <Settings className="size-3.5" />
                    <span className="sr-only">Settings</span>
                </Button>
            </Trigger>

            <Portal>
                <Overlay
                    className={cn(
                        'fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]',
                        'data-[state=closed]:animate-out data-[state=open]:animate-in',
                        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
                    )}
                />
                <Content
                    className={cn(
                        'fixed top-[50%] left-[50%] z-50',
                        'translate-x-[-50%] translate-y-[-50%]',
                        'h-[600px] max-h-[85vh] w-[860px] max-w-[90vw]',
                        'flex flex-col overflow-hidden rounded border border-border',
                        'bg-card',
                        'data-[state=closed]:animate-out data-[state=open]:animate-in',
                        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                        'data-[state=closed]:zoom-out-[0.98]',
                        'data-[state=open]:zoom-in-[0.98]',
                        'duration-200'
                    )}
                >
                    <Title className="sr-only">Settings</Title>
                    <Description className="sr-only">
                        Application settings and configuration
                    </Description>

                    <div className="flex min-h-0 flex-1">
                        <nav
                            className={cn(
                                'flex w-[160px] shrink-0 flex-col',
                                'border-border border-r bg-background'
                            )}
                        >
                            <div className="px-3 py-2.5">
                                <span
                                    className={cn(
                                        'font-semibold text-[11px] uppercase',
                                        'text-terminal-dim tracking-widest'
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
                                            className={cn(
                                                'flex w-full cursor-pointer items-center',
                                                'gap-2 rounded px-2.5 py-1.5',
                                                'text-[13px] transition-colors',
                                                isActive
                                                    ? 'bg-secondary font-medium text-foreground'
                                                    : 'text-muted-foreground hover:bg-secondary/50',
                                                isActive ? '' : 'hover:text-foreground'
                                            )}
                                            key={item.id}
                                            onClick={() => setActivePage(item.id)}
                                            type="button"
                                        >
                                            <Icon className="size-4" />
                                            <span>{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-auto border-border border-t px-3 py-2">
                                <span className="text-[10px] text-terminal-dim">
                                    EtsySentry v0.1.0
                                </span>
                            </div>
                        </nav>

                        <div className="min-h-0 flex-1 overflow-y-auto">
                            <div className="flex items-center justify-between px-4 py-2.5">
                                <h2 className="font-semibold text-base text-foreground">
                                    {navItems.find((n) => n.id === activePage)?.label ?? 'Settings'}
                                </h2>
                                <Close
                                    className={cn(
                                        'flex size-6 cursor-pointer items-center',
                                        'justify-center rounded text-muted-foreground',
                                        'transition-colors hover:bg-secondary',
                                        'hover:text-foreground'
                                    )}
                                >
                                    <XIcon className="size-4" />
                                    <span className="sr-only">Close</span>
                                </Close>
                            </div>

                            {activePage === 'general' ? <GeneralSettingsPage /> : null}
                            {activePage === 'etsy-api' ? (
                                <EtsyApiSettingsPage connection={connection} realtime={realtime} />
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
                </Content>
            </Portal>
        </Root>
    );
};

import { Check, Copy, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import type { EtsyApiUsage } from '@/lib/admin-api';
import type { ApiKeyRecord } from '@/lib/api-keys-api';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { maskApiKeyValue } from './api-key-utils';
import { formatTimestamp, sectionBarClassName, sectionBarLabelClassName } from './shared';

interface ApiKeysSettingsPageProps {
    activeApiKey: ApiKeyRecord | null;
    apiUsage: EtsyApiUsage | null;
    errorMessage: string | null;
    hasAdminAccess: boolean;
    isLoadingApiKey: boolean;
    isLoadingApiUsage: boolean;
    isRotatingApiKey: boolean;
    onRefreshApiKey: () => Promise<void>;
    onRefreshApiUsage: () => Promise<void>;
    onRotateApiKey: () => Promise<void>;
    rawApiKey: string | null;
}

interface UsageSectionProps {
    apiUsage: EtsyApiUsage | null;
    hasAdminAccess: boolean;
    isLoadingApiUsage: boolean;
    onRefreshApiUsage: () => Promise<void>;
}

interface ApiKeySectionProps {
    activeApiKey: ApiKeyRecord | null;
    isLoadingApiKey: boolean;
    isRotatingApiKey: boolean;
    onRefreshApiKey: () => Promise<void>;
    onRotateApiKey: () => Promise<void>;
    rawApiKey: string | null;
}

const getVisibleApiKeyValue = (params: {
    activeApiKey: ApiKeyRecord;
    rawApiKey: string | null;
    revealed: boolean;
}): string => {
    const hasRawActiveApiKey = params.rawApiKey?.startsWith(params.activeApiKey.keyPrefix) ?? false;

    if (hasRawActiveApiKey && params.rawApiKey) {
        return params.revealed ? params.rawApiKey : maskApiKeyValue(params.rawApiKey);
    }

    return `${params.activeApiKey.keyPrefix}${'*'.repeat(12)}`;
};

const UsageSection = ({
    apiUsage,
    hasAdminAccess,
    isLoadingApiUsage,
    onRefreshApiUsage,
}: UsageSectionProps) => {
    const perDayLimit = apiUsage?.rateLimit.perDayLimit ?? 0;
    const usedToday = useMemo(() => {
        if (!apiUsage) {
            return 0;
        }

        if (typeof apiUsage.rateLimit.remainingToday === 'number' && perDayLimit > 0) {
            return Math.max(0, perDayLimit - apiUsage.rateLimit.remainingToday);
        }

        return apiUsage.stats.callsPast24Hours;
    }, [apiUsage, perDayLimit]);

    const usageProgress = perDayLimit > 0 ? Math.min(100, (usedToday / perDayLimit) * 100) : 0;

    let usageBody: ReactNode = null;

    if (!hasAdminAccess) {
        usageBody = <p className="text-muted-foreground text-xs">Admin access required.</p>;
    } else if (isLoadingApiUsage) {
        usageBody = <p className="text-muted-foreground text-xs">Loading usage...</p>;
    } else {
        usageBody = (
            <>
                <div className="flex items-center gap-4">
                    <p className="font-mono text-2xl text-foreground">
                        {usedToday.toLocaleString()}
                    </p>
                    <div className="min-w-0 flex-1">
                        <p className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                            Requests (24h)
                        </p>
                        <div className="mt-1.5">
                            <Progress value={usageProgress} />
                        </div>
                    </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                    {perDayLimit > 0
                        ? `${Math.round(usageProgress)}% of ${perDayLimit.toLocaleString()} daily budget`
                        : 'Daily limit is unavailable.'}
                </p>
            </>
        );
    }

    return (
        <>
            <div className={sectionBarClassName}>
                <span className={sectionBarLabelClassName}>Usage</span>
                <button
                    className="flex cursor-pointer items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider transition-colors hover:text-foreground"
                    disabled={!hasAdminAccess || isLoadingApiUsage}
                    onClick={() => {
                        onRefreshApiUsage();
                    }}
                    type="button"
                >
                    <RefreshCw
                        className={cn('size-3', isLoadingApiUsage ? 'animate-spin' : undefined)}
                    />
                    Refresh
                </button>
            </div>

            <div className="space-y-2 border-border border-b px-4 py-3">{usageBody}</div>
        </>
    );
};

const ApiKeySection = ({
    activeApiKey,
    isLoadingApiKey,
    isRotatingApiKey,
    onRefreshApiKey,
    onRotateApiKey,
    rawApiKey,
}: ApiKeySectionProps) => {
    const [revealed, setRevealed] = useState(false);
    const [copied, setCopied] = useState(false);

    const hasRawActiveApiKey =
        activeApiKey !== null && Boolean(rawApiKey?.startsWith(activeApiKey.keyPrefix));

    const handleCopyApiKey = async () => {
        if (!(rawApiKey && hasRawActiveApiKey)) {
            return;
        }

        try {
            await navigator.clipboard.writeText(rawApiKey);
            setCopied(true);
            window.setTimeout(() => {
                setCopied(false);
            }, 1200);
        } catch {
            setCopied(false);
        }
    };

    let keyBody: ReactNode = null;

    if (isLoadingApiKey) {
        keyBody = <p className="text-muted-foreground text-xs">Loading key...</p>;
    } else if (activeApiKey) {
        const visibilityIcon = revealed ? (
            <EyeOff className="size-3.5" />
        ) : (
            <Eye className="size-3.5" />
        );
        const copyIcon = copied ? (
            <Check className="size-3.5 text-terminal-green" />
        ) : (
            <Copy className="size-3.5" />
        );

        keyBody = (
            <>
                <div className="flex items-center gap-2 rounded border border-border bg-background px-2 py-1.5">
                    <code className="min-w-0 flex-1 truncate font-mono text-foreground text-xs">
                        {getVisibleApiKeyValue({
                            activeApiKey,
                            rawApiKey,
                            revealed,
                        })}
                    </code>
                    <button
                        aria-label={revealed ? 'Hide API key' : 'Show API key'}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => {
                            setRevealed((current) => !current);
                        }}
                        type="button"
                    >
                        {visibilityIcon}
                    </button>
                    <button
                        aria-label="Copy API key"
                        className={cn(
                            'transition-colors',
                            hasRawActiveApiKey
                                ? 'text-muted-foreground hover:text-foreground'
                                : 'cursor-default text-muted-foreground/40'
                        )}
                        disabled={!hasRawActiveApiKey}
                        onClick={() => {
                            handleCopyApiKey();
                        }}
                        type="button"
                    >
                        {copyIcon}
                    </button>
                </div>

                <p className="text-[11px] text-muted-foreground">
                    Created: {formatTimestamp(activeApiKey.createdAt)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                    Last used: {formatTimestamp(activeApiKey.lastUsedAt)}
                </p>
                {hasRawActiveApiKey ? null : (
                    <p className="text-[11px] text-muted-foreground">
                        Full key is hidden. Rotate to reveal and copy a new key.
                    </p>
                )}
            </>
        );
    } else {
        keyBody = <p className="text-muted-foreground text-xs">No API key found.</p>;
    }

    return (
        <>
            <div className={sectionBarClassName}>
                <div className="flex items-center gap-2">
                    <span className={sectionBarLabelClassName}>API Key</span>
                    {activeApiKey ? (
                        <span className="size-1.5 rounded-full bg-terminal-green" />
                    ) : null}
                </div>
                <button
                    className="flex cursor-pointer items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider transition-colors hover:text-foreground"
                    disabled={isLoadingApiKey}
                    onClick={() => {
                        onRefreshApiKey();
                    }}
                    type="button"
                >
                    <RefreshCw
                        className={cn('size-3', isLoadingApiKey ? 'animate-spin' : undefined)}
                    />
                    Refresh
                </button>
            </div>

            <div className="space-y-2 border-border border-b px-4 py-3">
                {keyBody}

                <Button
                    className="mt-1 h-7 w-full rounded-sm text-xs"
                    disabled={isRotatingApiKey}
                    onClick={() => {
                        onRotateApiKey();
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    <RefreshCw
                        className={cn('size-3', isRotatingApiKey ? 'animate-spin' : undefined)}
                    />
                    {activeApiKey ? 'Rotate Key' : 'Generate Key'}
                </Button>
            </div>
        </>
    );
};

export const ApiKeysSettingsPage = ({
    activeApiKey,
    apiUsage,
    errorMessage,
    hasAdminAccess,
    isLoadingApiKey,
    isLoadingApiUsage,
    isRotatingApiKey,
    onRefreshApiKey,
    onRefreshApiUsage,
    onRotateApiKey,
    rawApiKey,
}: ApiKeysSettingsPageProps) => {
    return (
        <div>
            <UsageSection
                apiUsage={apiUsage}
                hasAdminAccess={hasAdminAccess}
                isLoadingApiUsage={isLoadingApiUsage}
                onRefreshApiUsage={onRefreshApiUsage}
            />
            <ApiKeySection
                activeApiKey={activeApiKey}
                isLoadingApiKey={isLoadingApiKey}
                isRotatingApiKey={isRotatingApiKey}
                onRefreshApiKey={onRefreshApiKey}
                onRotateApiKey={onRotateApiKey}
                rawApiKey={rawApiKey}
            />

            {errorMessage ? (
                <div className="px-4 py-1.5">
                    <p className="text-terminal-red text-xs">{errorMessage}</p>
                </div>
            ) : null}
        </div>
    );
};

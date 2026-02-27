import { TrpcRequestError } from '@/lib/trpc-http';

export type SettingsPage = 'general' | 'etsy-api' | 'api-keys' | 'currency' | 'admin';

export const sectionBarClassName =
    'flex items-center justify-between -mt-px border-y border-border bg-secondary px-4 py-1.5';

export const sectionBarLabelClassName =
    'text-[11px] font-medium uppercase tracking-widest text-muted-foreground';

export const dataRowClassName =
    'flex items-center justify-between border-b border-border/50 px-4 py-1.5';

export const wideButtonClassName =
    'flex w-full cursor-pointer items-center justify-center gap-1.5 ' +
    'border-b border-border bg-secondary/30 px-4 py-2 text-[11px] font-medium ' +
    'uppercase tracking-wider text-foreground transition-colors ' +
    'hover:bg-secondary/60 disabled:cursor-default disabled:opacity-50';

export const wideDangerButtonClassName =
    'flex w-full cursor-pointer items-center justify-center gap-1.5 ' +
    'border-b border-border bg-secondary/30 px-4 py-2 text-[11px] font-medium ' +
    'uppercase tracking-wider text-terminal-red transition-colors ' +
    'hover:bg-terminal-red/5 disabled:cursor-default disabled:opacity-50';

export const formatTimestamp = (value: string | null): string => {
    if (!value) {
        return 'N/A';
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        return 'N/A';
    }

    return parsed.toLocaleString();
};

export const formatElapsedSinceTimestamp = (value: string | null, nowMs: number): string => {
    if (!value) {
        return 'N/A';
    }

    const parsedMs = new Date(value).getTime();

    if (Number.isNaN(parsedMs)) {
        return 'N/A';
    }

    const elapsedSeconds = Math.max(0, Math.floor((nowMs - parsedMs) / 1000));

    if (elapsedSeconds < 5) {
        return 'just now';
    }

    if (elapsedSeconds < 60) {
        return `${elapsedSeconds} sec ago`;
    }

    const elapsedMinutes = Math.floor(elapsedSeconds / 60);

    if (elapsedMinutes < 60) {
        return `${elapsedMinutes} min ago`;
    }

    return `${Math.floor(elapsedMinutes / 60)} hr ago`;
};

export const formatDurationMs = (value: number): string => {
    if (value <= 0) {
        return '0 ms';
    }

    if (value < 1000) {
        return `${value} ms`;
    }

    const seconds = value / 1000;

    if (seconds < 60) {
        return `${seconds.toFixed(1)} sec`;
    }

    return `${(seconds / 60).toFixed(1)} min`;
};

export const formatTrpcErrorMessage = (error: unknown, fallbackMessage: string): string => {
    if (error instanceof TrpcRequestError) {
        return error.message;
    }

    if (error instanceof Error && error.message.length > 0) {
        return error.message;
    }

    return fallbackMessage;
};

export const formatCurrencyErrorMessage = (error: unknown): string => {
    return formatTrpcErrorMessage(error, 'Unexpected currency conversion request failure.');
};

export const formatListingResyncErrorMessage = (error: unknown): string => {
    return formatTrpcErrorMessage(error, 'Unexpected listing resync request failure.');
};

export const formatEtsyApiUsageErrorMessage = (error: unknown): string => {
    return formatTrpcErrorMessage(error, 'Unexpected Etsy API usage request failure.');
};

export const formatListingRefreshPolicyErrorMessage = (error: unknown): string => {
    return formatTrpcErrorMessage(error, 'Unexpected listing refresh policy request failure.');
};

export const formatApiKeyErrorMessage = (error: unknown): string => {
    return formatTrpcErrorMessage(error, 'Unexpected API key request failure.');
};

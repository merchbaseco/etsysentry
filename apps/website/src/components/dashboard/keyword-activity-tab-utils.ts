import type { GetKeywordActivityOutput } from '@/lib/keywords-api';
import { TrpcRequestError } from '@/lib/trpc-http';

export const DAYS_OPTIONS = [7, 14, 30] as const;
export type KeywordActivityDaysOption = (typeof DAYS_OPTIONS)[number];
export const DEFAULT_KEYWORD_ACTIVITY_DAYS: KeywordActivityDaysOption = 30;

const isOptionalString = (value: unknown): value is string | undefined => {
    return value === undefined || typeof value === 'string';
};

const toNonEmptyTrimmedString = (value: unknown): string | null => {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

export const isKeywordActivityTabState = (
    value: unknown
): value is { keyword?: string; trackedKeywordId?: string } => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const record = value as Record<string, unknown>;
    return isOptionalString(record.keyword) && isOptionalString(record.trackedKeywordId);
};

export const toKeywordActivityErrorMessage = (error: unknown): string => {
    if (error instanceof TrpcRequestError) {
        return error.message;
    }

    if (error instanceof Error && error.message.length > 0) {
        return error.message;
    }

    return 'Unexpected request failure.';
};

export const toKeywordActivityPrimaryErrorMessage = (params: {
    error: unknown;
    hasTrackedKeywordId: boolean;
}): string | null => {
    if (params.error) {
        return toKeywordActivityErrorMessage(params.error);
    }

    if (!params.hasTrackedKeywordId) {
        return 'Missing tracked keyword id.';
    }

    return null;
};

export const toKeywordActivitySummary = (
    items: GetKeywordActivityOutput['items'] | undefined
): { avgRank: string; rankedCount: number } => {
    const rows = items ?? [];

    if (rows.length === 0) {
        return {
            avgRank: '--',
            rankedCount: 0,
        };
    }

    const rankTotal = rows.reduce((acc, item) => acc + item.currentRank, 0);

    return {
        avgRank: (rankTotal / rows.length).toFixed(1),
        rankedCount: rows.length,
    };
};

export const toKeywordActivityTitle = (params: {
    activityKeyword: string | null | undefined;
    locationKeyword: string | undefined;
    trackedKeywordId: string | undefined;
}): string => {
    const fromActivity = toNonEmptyTrimmedString(params.activityKeyword);

    if (fromActivity) {
        return fromActivity;
    }

    const fromLocation = toNonEmptyTrimmedString(params.locationKeyword);

    if (fromLocation) {
        return fromLocation;
    }

    const fromPath = toNonEmptyTrimmedString(params.trackedKeywordId);

    if (fromPath) {
        return `Keyword ${fromPath.slice(0, 8)}`;
    }

    return 'Keyword Activity';
};

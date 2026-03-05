export interface KeywordActivityTab {
    keyword: string;
    trackedKeywordId: string;
}

const KEYWORD_ACTIVITY_STORAGE_KEY = 'etsysentry.keyword-activity-tabs.v1';
const KEYWORD_ACTIVITY_PATH_PREFIX = '/keywords/activity/';
export const MAX_OPEN_KEYWORD_ACTIVITY_TABS = 6;

const isNonEmptyString = (value: unknown): value is string => {
    return typeof value === 'string' && value.trim().length > 0;
};

export const normalizeKeywordTabLabel = (value: string): string => {
    const normalized = value.trim();

    if (normalized.length <= 24) {
        return normalized;
    }

    return `${normalized.slice(0, 21)}...`;
};

export const toKeywordActivityPath = (trackedKeywordId: string): string => {
    return `${KEYWORD_ACTIVITY_PATH_PREFIX}${trackedKeywordId}`;
};

export const parseKeywordActivityPath = (pathname: string): { trackedKeywordId: string } | null => {
    if (!pathname.startsWith(KEYWORD_ACTIVITY_PATH_PREFIX)) {
        return null;
    }

    const trackedKeywordId = pathname.slice(KEYWORD_ACTIVITY_PATH_PREFIX.length);

    if (!isNonEmptyString(trackedKeywordId) || trackedKeywordId.includes('/')) {
        return null;
    }

    return {
        trackedKeywordId,
    };
};

const toTabRecord = (value: unknown): KeywordActivityTab | null => {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const record = value as Record<string, unknown>;

    if (!(isNonEmptyString(record.trackedKeywordId) && isNonEmptyString(record.keyword))) {
        return null;
    }

    return {
        keyword: normalizeKeywordTabLabel(record.keyword),
        trackedKeywordId: record.trackedKeywordId.trim(),
    };
};

export const loadKeywordActivityTabs = (): KeywordActivityTab[] => {
    if (typeof window === 'undefined') {
        return [];
    }

    const raw = window.localStorage.getItem(KEYWORD_ACTIVITY_STORAGE_KEY);

    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        const tabs = parsed.map(toTabRecord).filter((item) => item !== null);

        return tabs.slice(-MAX_OPEN_KEYWORD_ACTIVITY_TABS);
    } catch {
        return [];
    }
};

export const saveKeywordActivityTabs = (tabs: KeywordActivityTab[]): void => {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(KEYWORD_ACTIVITY_STORAGE_KEY, JSON.stringify(tabs));
};

export const upsertKeywordActivityTab = (
    current: KeywordActivityTab[],
    next: KeywordActivityTab
): KeywordActivityTab[] => {
    const normalizedLabel = normalizeKeywordTabLabel(next.keyword);
    const existingIndex = current.findIndex(
        (item) => item.trackedKeywordId === next.trackedKeywordId
    );

    if (existingIndex >= 0) {
        const existing = current[existingIndex];

        if (existing && existing.keyword === normalizedLabel) {
            return current;
        }

        const nextTabs = [...current];
        nextTabs[existingIndex] = {
            keyword: normalizedLabel,
            trackedKeywordId: next.trackedKeywordId,
        };

        return nextTabs;
    }

    return [
        ...current,
        { keyword: normalizedLabel, trackedKeywordId: next.trackedKeywordId },
    ].slice(-MAX_OPEN_KEYWORD_ACTIVITY_TABS);
};

export const removeKeywordActivityTab = (
    current: KeywordActivityTab[],
    trackedKeywordId: string
): KeywordActivityTab[] => {
    const nextTabs = current.filter((item) => item.trackedKeywordId !== trackedKeywordId);

    if (nextTabs.length === current.length) {
        return current;
    }

    return nextTabs;
};

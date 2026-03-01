export interface ShopActivityTab {
    etsyShopId: string;
    shopName: string;
}

const SHOP_ACTIVITY_STORAGE_KEY = 'etsysentry.shop-activity-tabs.v2';
const SHOP_ACTIVITY_PATH_PREFIX = '/shops/activity/';
export const MAX_OPEN_SHOP_ACTIVITY_TABS = 6;

const isNonEmptyString = (value: unknown): value is string => {
    return typeof value === 'string' && value.trim().length > 0;
};

export const normalizeShopTabLabel = (value: string): string => {
    const normalized = value.trim();

    if (normalized.length <= 24) {
        return normalized;
    }

    return `${normalized.slice(0, 21)}...`;
};

export const toShopActivityPath = (etsyShopId: string): string => {
    return `${SHOP_ACTIVITY_PATH_PREFIX}${etsyShopId}`;
};

export const parseShopActivityPath = (pathname: string): { etsyShopId: string } | null => {
    if (!pathname.startsWith(SHOP_ACTIVITY_PATH_PREFIX)) {
        return null;
    }

    const etsyShopId = pathname.slice(SHOP_ACTIVITY_PATH_PREFIX.length);

    if (!isNonEmptyString(etsyShopId) || etsyShopId.includes('/')) {
        return null;
    }

    return {
        etsyShopId,
    };
};

const toTabRecord = (value: unknown): ShopActivityTab | null => {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const record = value as Record<string, unknown>;

    if (!(isNonEmptyString(record.etsyShopId) && isNonEmptyString(record.shopName))) {
        return null;
    }

    return {
        etsyShopId: record.etsyShopId.trim(),
        shopName: normalizeShopTabLabel(record.shopName),
    };
};

export const loadShopActivityTabs = (): ShopActivityTab[] => {
    if (typeof window === 'undefined') {
        return [];
    }

    const raw = window.localStorage.getItem(SHOP_ACTIVITY_STORAGE_KEY);

    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        const tabs = parsed.map(toTabRecord).filter((item) => item !== null);

        return tabs.slice(-MAX_OPEN_SHOP_ACTIVITY_TABS);
    } catch {
        return [];
    }
};

export const saveShopActivityTabs = (tabs: ShopActivityTab[]): void => {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(SHOP_ACTIVITY_STORAGE_KEY, JSON.stringify(tabs));
};

export const upsertShopActivityTab = (
    current: ShopActivityTab[],
    next: ShopActivityTab
): ShopActivityTab[] => {
    const normalizedLabel = normalizeShopTabLabel(next.shopName);
    const existingIndex = current.findIndex((item) => item.etsyShopId === next.etsyShopId);

    if (existingIndex >= 0) {
        const existing = current[existingIndex];

        if (existing && existing.shopName === normalizedLabel) {
            return current;
        }

        const nextTabs = [...current];
        nextTabs[existingIndex] = {
            etsyShopId: next.etsyShopId,
            shopName: normalizedLabel,
        };

        return nextTabs;
    }

    return [...current, { etsyShopId: next.etsyShopId, shopName: normalizedLabel }].slice(
        -MAX_OPEN_SHOP_ACTIVITY_TABS
    );
};

export const removeShopActivityTab = (
    current: ShopActivityTab[],
    etsyShopId: string
): ShopActivityTab[] => {
    const nextTabs = current.filter((item) => item.etsyShopId !== etsyShopId);

    if (nextTabs.length === current.length) {
        return current;
    }

    return nextTabs;
};

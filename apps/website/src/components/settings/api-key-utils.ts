import type { ApiKeyRecord } from '@/lib/api-keys-api';

const toCreatedAtMs = (value: string): number => {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

export const pickNewestApiKey = (items: readonly ApiKeyRecord[]): ApiKeyRecord | null => {
    let newestItem: ApiKeyRecord | null = null;

    for (const item of items) {
        if (!newestItem) {
            newestItem = item;
            continue;
        }

        if (toCreatedAtMs(item.createdAt) > toCreatedAtMs(newestItem.createdAt)) {
            newestItem = item;
        }
    }

    return newestItem;
};

export const maskApiKeyValue = (value: string): string => {
    if (value.length <= 10) {
        return '*'.repeat(value.length);
    }

    return `${value.slice(0, 7)}${'*'.repeat(10)}${value.slice(-4)}`;
};

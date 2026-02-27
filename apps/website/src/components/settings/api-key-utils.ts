import type { ApiKeyRecord } from '@/lib/api-keys-api';

const toCreatedAtMs = (value: string): number => {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

export const pickNewestActiveApiKey = (items: readonly ApiKeyRecord[]): ApiKeyRecord | null => {
    let newestActiveItem: ApiKeyRecord | null = null;

    for (const item of items) {
        if (item.revokedAt) {
            continue;
        }

        if (!newestActiveItem) {
            newestActiveItem = item;
            continue;
        }

        if (toCreatedAtMs(item.createdAt) > toCreatedAtMs(newestActiveItem.createdAt)) {
            newestActiveItem = item;
        }
    }

    return newestActiveItem;
};

export const maskApiKeyValue = (value: string): string => {
    if (value.length <= 10) {
        return '*'.repeat(value.length);
    }

    return `${value.slice(0, 7)}${'*'.repeat(10)}${value.slice(-4)}`;
};

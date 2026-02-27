import { LISTING_TRACKING_STATE_VALUES, METRIC_VALUES, PERFORMANCE_MODE_VALUES, SYNC_STATE_VALUES, TRACKING_STATE_VALUES, } from './constants.js';
import { failWith } from './errors.js';
const containsSearchText = (value, search) => {
    if (!search) {
        return true;
    }
    return (value ?? '').toLowerCase().includes(search.toLowerCase());
};
const assertSyncState = (value) => {
    if (!value) {
        return undefined;
    }
    if (!SYNC_STATE_VALUES.includes(value)) {
        failWith({
            code: 'BAD_REQUEST',
            message: 'Invalid sync state.',
            details: { allowed: SYNC_STATE_VALUES, value },
        });
    }
    return value;
};
const assertTrackingState = (params) => {
    if (!params.value) {
        return undefined;
    }
    if (!params.allowed.includes(params.value)) {
        failWith({
            code: 'BAD_REQUEST',
            message: 'Invalid tracking state.',
            details: { allowed: params.allowed, value: params.value },
        });
    }
    return params.value;
};
export const parsePerformanceMode = (value) => {
    if (!value) {
        return 'metrics';
    }
    if (!PERFORMANCE_MODE_VALUES.includes(value)) {
        failWith({
            code: 'BAD_REQUEST',
            message: 'Mode must be metrics or table.',
        });
    }
    return value;
};
export const parsePerformanceMetrics = (value) => {
    if (!value) {
        return undefined;
    }
    const parsed = Array.from(new Set(value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)));
    if (parsed.length === 0) {
        failWith({
            code: 'BAD_REQUEST',
            message: 'Metrics list cannot be empty when provided.',
        });
    }
    for (const item of parsed) {
        if (!METRIC_VALUES.includes(item)) {
            failWith({
                code: 'BAD_REQUEST',
                message: 'Invalid metric.',
                details: { allowed: METRIC_VALUES, value: item },
            });
        }
    }
    return parsed;
};
export const filterKeywordItems = (items, flags) => {
    const trackingState = assertTrackingState({
        allowed: TRACKING_STATE_VALUES,
        value: flags.trackingState,
    });
    const syncState = assertSyncState(flags.syncState);
    return items.filter((item) => {
        if (trackingState && item.trackingState !== trackingState) {
            return false;
        }
        if (syncState && item.syncState !== syncState) {
            return false;
        }
        return containsSearchText(item.keyword, flags.search);
    });
};
export const filterListingItems = (items, flags) => {
    const trackingState = assertTrackingState({
        allowed: LISTING_TRACKING_STATE_VALUES,
        value: flags.trackingState,
    });
    const syncState = assertSyncState(flags.syncState);
    return items.filter((item) => {
        if (!flags.showDigital && item.isDigital) {
            return false;
        }
        if (trackingState && item.trackingState !== trackingState) {
            return false;
        }
        if (syncState && item.syncState !== syncState) {
            return false;
        }
        return (containsSearchText(item.title, flags.search) ||
            containsSearchText(item.etsyListingId, flags.search) ||
            containsSearchText(item.shopName, flags.search));
    });
};
export const filterShopItems = (items, flags) => {
    const trackingState = assertTrackingState({
        allowed: TRACKING_STATE_VALUES,
        value: flags.trackingState,
    });
    const syncState = assertSyncState(flags.syncState);
    return items.filter((item) => {
        if (trackingState && item.trackingState !== trackingState) {
            return false;
        }
        if (syncState && item.syncState !== syncState) {
            return false;
        }
        return (containsSearchText(item.shopName, flags.search) ||
            containsSearchText(item.etsyShopId, flags.search));
    });
};

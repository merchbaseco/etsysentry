import { describe, expect, test } from 'bun:test';
import {
    MAX_OPEN_SHOP_ACTIVITY_TABS,
    normalizeShopTabLabel,
    parseShopActivityPath,
    removeShopActivityTab,
    toShopActivityPath,
    upsertShopActivityTab,
} from '@/components/dashboard/shop-activity-tabs-state';

describe('parseShopActivityPath', () => {
    test('parses valid shop activity path', () => {
        expect(parseShopActivityPath('/shops/activity/shop-123')).toEqual({
            etsyShopId: 'shop-123',
        });
    });

    test('returns null for unrelated paths', () => {
        expect(parseShopActivityPath('/shops')).toBeNull();
    });

    test('returns null when path contains nested segments', () => {
        expect(parseShopActivityPath('/shops/activity/shop-123/details')).toBeNull();
    });
});

describe('toShopActivityPath', () => {
    test('builds shop activity route from tracked shop id', () => {
        expect(toShopActivityPath('abc')).toBe('/shops/activity/abc');
    });
});

describe('upsertShopActivityTab', () => {
    test('adds a new tab record', () => {
        expect(
            upsertShopActivityTab([], {
                etsyShopId: 'shop-1',
                shopName: 'Teesmithy',
            })
        ).toEqual([
            {
                etsyShopId: 'shop-1',
                shopName: 'Teesmithy',
            },
        ]);
    });

    test('updates existing labels without duplicating the tab', () => {
        expect(
            upsertShopActivityTab(
                [
                    {
                        etsyShopId: 'shop-1',
                        shopName: 'Teesmithy',
                    },
                ],
                {
                    etsyShopId: 'shop-1',
                    shopName: 'Teesmithy Ltd',
                }
            )
        ).toEqual([
            {
                etsyShopId: 'shop-1',
                shopName: 'Teesmithy Ltd',
            },
        ]);
    });

    test('keeps the tab list capped to the max open limit', () => {
        const seed = Array.from({ length: MAX_OPEN_SHOP_ACTIVITY_TABS }, (_, index) => ({
            etsyShopId: `shop-${index}`,
            shopName: `Shop ${index}`,
        }));

        const nextTabs = upsertShopActivityTab(seed, {
            etsyShopId: 'shop-new',
            shopName: 'Shop New',
        });

        expect(nextTabs).toHaveLength(MAX_OPEN_SHOP_ACTIVITY_TABS);
        expect(nextTabs[0]?.etsyShopId).toBe('shop-1');
        expect(nextTabs.at(-1)?.etsyShopId).toBe('shop-new');
    });
});

describe('removeShopActivityTab', () => {
    test('removes an existing tab by etsy shop id', () => {
        expect(
            removeShopActivityTab(
                [
                    {
                        etsyShopId: 'shop-1',
                        shopName: 'Teesmithy',
                    },
                    {
                        etsyShopId: 'shop-2',
                        shopName: 'Lupita',
                    },
                ],
                'shop-1'
            )
        ).toEqual([
            {
                etsyShopId: 'shop-2',
                shopName: 'Lupita',
            },
        ]);
    });
});

describe('normalizeShopTabLabel', () => {
    test('trims and truncates oversized labels', () => {
        expect(
            normalizeShopTabLabel('  This label is definitely over twenty-four characters  ')
        ).toBe('This label is definit...');
    });
});

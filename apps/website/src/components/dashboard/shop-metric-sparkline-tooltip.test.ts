import { describe, expect, test } from 'bun:test';
import { getSparklineTooltipPortalPosition } from '@/components/dashboard/shop-metric-sparkline';

describe('ShopMetricSparkline', () => {
    test('positions a portaled tooltip using the chart bounds and active coordinate', () => {
        expect(
            getSparklineTooltipPortalPosition({
                containerBounds: {
                    left: 120,
                    top: 48,
                },
                coordinate: {
                    x: 300,
                },
            })
        ).toEqual({
            left: 432,
            top: 76,
        });
    });

    test('returns null when the tooltip x coordinate is missing', () => {
        expect(
            getSparklineTooltipPortalPosition({
                containerBounds: {
                    left: 120,
                    top: 48,
                },
                coordinate: {},
            })
        ).toBeNull();
    });
});

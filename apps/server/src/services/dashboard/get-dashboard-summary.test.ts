import { describe, expect, test } from 'bun:test';
import { toDashboardApiUsageCounts } from './get-dashboard-summary';

describe('toDashboardApiUsageCounts', () => {
    test('maps Etsy usage stats into dashboard API usage counts', () => {
        expect(
            toDashboardApiUsageCounts({
                callsPast24Hours: 41,
                callsPastHour: 9
            })
        ).toEqual({
            etsyApiCallsPast24Hours: 41,
            etsyApiCallsPastHour: 9
        });
    });
});

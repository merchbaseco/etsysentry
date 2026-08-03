import { describe, expect, test } from 'bun:test';
import { syncKeywordJobInputSchema } from './sync-keyword-shared';
import { syncListingJobInputSchema } from './sync-listing-shared';
import { syncShopJobInputSchema } from './sync-shop-shared';

describe('background job ownership contract', () => {
    test('uses account ownership without carrying a Clerk or Merchbase user identity', () => {
        expect(
            syncKeywordJobInputSchema.parse({
                accountId: 'account-test',
                trackedKeywordId: '00000000-0000-4000-8000-000000000001',
            })
        ).toEqual({
            accountId: 'account-test',
            trackedKeywordId: '00000000-0000-4000-8000-000000000001',
        });

        expect(
            syncListingJobInputSchema.parse({
                accountId: 'account-test',
                etsyListingId: 'listing-test',
                merchbaseUserId: 'mbu_unneeded',
            })
        ).toEqual({
            accountId: 'account-test',
            etsyListingId: 'listing-test',
        });

        expect(
            syncShopJobInputSchema.parse({
                accountId: 'account-test',
                trackedShopId: '00000000-0000-4000-8000-000000000002',
            })
        ).toEqual({
            accountId: 'account-test',
            trackedShopId: '00000000-0000-4000-8000-000000000002',
        });
    });
});

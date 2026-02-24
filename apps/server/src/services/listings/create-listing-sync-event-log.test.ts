import { describe, expect, test } from 'bun:test';
import {
    buildListingSyncFailedEventLogInput,
    buildListingSyncedEventLogInput
} from './create-listing-sync-event-log';

describe('buildListingSyncedEventLogInput', () => {
    test('builds a listing synced event payload', () => {
        const payload = buildListingSyncedEventLogInput({
            accountId: 'tenant_123',
            clerkUserId: 'user_123',
            etsyListingId: '1234567890',
            etsyState: 'active',
            listingId: 'listing_123',
            monitorRunId: 'job_123',
            requestId: 'request_123',
            shopId: 'shop_123',
            title: 'Sample listing'
        });

        expect(payload).toEqual({
            action: 'listing.synced',
            category: 'listing',
            clerkUserId: 'user_123',
            detailsJson: {
                etsyState: 'active',
                title: 'Sample listing'
            },
            level: 'info',
            listingId: '1234567890',
            message: 'Synced listing 1234567890.',
            monitorRunId: 'job_123',
            primitiveId: 'listing_123',
            primitiveType: 'listing',
            requestId: 'request_123',
            shopId: 'shop_123',
            status: 'success',
            accountId: 'tenant_123'
        });
    });
});

describe('buildListingSyncFailedEventLogInput', () => {
    test('builds a listing sync failed payload with nullable ids', () => {
        const payload = buildListingSyncFailedEventLogInput({
            accountId: 'tenant_123',
            clerkUserId: 'user_123',
            errorMessage: 'Etsy listing was not found.',
            etsyListingId: '1234567890'
        });

        expect(payload).toEqual({
            action: 'listing.sync_failed',
            category: 'listing',
            clerkUserId: 'user_123',
            detailsJson: {
                error: 'Etsy listing was not found.'
            },
            level: 'error',
            listingId: '1234567890',
            message: 'Listing sync failed for 1234567890: Etsy listing was not found.',
            monitorRunId: null,
            primitiveId: null,
            primitiveType: 'listing',
            requestId: null,
            shopId: null,
            status: 'failed',
            accountId: 'tenant_123'
        });
    });
});

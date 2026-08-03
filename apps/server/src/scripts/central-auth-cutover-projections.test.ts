import { describe, expect, test } from 'bun:test';
import { TERMINAL_PROJECTION_TIMESTAMP } from '@merchbaseco/access';
import { parseCutoverMapping } from './central-auth-cutover-lib';
import { buildCutoverProjectionSeeds } from './central-auth-cutover-projections';

describe('central auth cutover projection seeds', () => {
    test('tombstones a retired identity under its own issuer', () => {
        const mapping = parseCutoverMapping({
            accountId: 'account-test',
            merchbaseUserId: 'mbu_test',
            retained: {
                issuer: 'https://retained.clerk.example',
                subject: 'user_retained',
                sourceUpdatedAt: 100,
                access: 'granted',
                accessValidUntil: null,
            },
            retiredIdentities: [
                {
                    issuer: 'https://retired.clerk.example',
                    subject: 'user_retired',
                },
            ],
            expected: {
                global: {
                    accountCount: 1,
                    activeLegacyApiKeyCount: 1,
                    clerkIdentityCount: 2,
                    duplicateNormalizedEmailGroupCount: 1,
                    etsyOAuthConnectionCount: 1,
                },
                target: {
                    accountIdentityCount: 2,
                    activeLegacyApiKeyCount: 1,
                    etsyOAuthConnectionCount: 1,
                    legacyOwnershipReferenceCount: 0,
                    systemEtsyApiCallEventCount: 0,
                },
            },
        });

        const seeds = buildCutoverProjectionSeeds(mapping);

        expect(seeds).toHaveLength(2);
        expect(seeds[0]).toMatchObject({
            identity: {
                issuer: 'https://retained.clerk.example',
                subject: 'user_retained',
            },
        });
        expect(seeds[1]).toMatchObject({
            identity: {
                issuer: 'https://retired.clerk.example',
                subject: 'user_retired',
            },
            projection: null,
            sourceUpdatedAt: TERMINAL_PROJECTION_TIMESTAMP,
        });
    });
});

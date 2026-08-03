import { describe, expect, test } from 'bun:test';
import {
    assertCutoverAuditMatchesMapping,
    buildCutoverPlan,
    type CutoverAudit,
    expectedIdentitySetFingerprint,
    mappingFingerprint,
    parseCutoverMapping,
    parseCutoverPlan,
} from './central-auth-cutover-lib';

const mapping = parseCutoverMapping({
    accountId: 'account-test',
    issuer: 'https://clerk.example',
    merchbaseUserId: 'mbu_test',
    retained: {
        subject: 'user_retained',
        sourceUpdatedAt: 100,
        access: 'granted',
        accessValidUntil: null,
    },
    retiredSubjects: ['user_retired'],
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
        },
    },
});

const audit: CutoverAudit = {
    global: {
        accountCount: 1,
        activeLegacyApiKeyCount: 1,
        clerkIdentityCount: 2,
        duplicateNormalizedEmailGroupCount: 1,
        etsyOAuthConnectionCount: 1,
    },
    target: {
        accountRowCount: 1,
        activeLegacyApiKeyCount: 1,
        etsyOAuthConnectionCount: 1,
        identityCount: 2,
        identitySetFingerprint: expectedIdentitySetFingerprint(mapping),
        productRowCounts: {
            currencyRates: 0,
            etsyApiCallEvents: 0,
            etsyOAuthConnections: 1,
            eventLogs: 0,
            listingMetricSnapshots: 0,
            listingTags: 0,
            productKeywordRanks: 0,
            tags: 0,
            trackedKeywords: 0,
            trackedListings: 0,
            trackedShopListings: 0,
            trackedShopSnapshots: 0,
            trackedShops: 0,
        },
    },
};

describe('central auth cutover planner', () => {
    test('accepts only the explicit identity set supplied by the operator', () => {
        expect(() => assertCutoverAuditMatchesMapping({ audit, mapping })).not.toThrow();
        expect(mappingFingerprint(mapping)).toHaveLength(64);
    });

    test('fails closed when an identity changes', () => {
        const target = audit.target;

        if (!target) {
            throw new Error('Test audit must include a target.');
        }

        expect(() =>
            assertCutoverAuditMatchesMapping({
                audit: {
                    ...audit,
                    target: {
                        ...target,
                        identitySetFingerprint: 'changed',
                    },
                },
                mapping,
            })
        ).toThrow('issuer/subject set changed');
    });

    test('rejects a mapping that tries to retain and retire the same subject', () => {
        expect(() =>
            parseCutoverMapping({
                ...mapping,
                retiredSubjects: ['user_retained'],
            })
        ).toThrow();
    });

    test('plan digest changes when audited facts change', () => {
        const first = buildCutoverPlan({ audit, mapping });
        const second = buildCutoverPlan({
            audit: {
                ...audit,
                global: {
                    ...audit.global,
                    activeLegacyApiKeyCount: 2,
                },
            },
            mapping,
        });

        expect(first.planDigest).not.toBe(second.planDigest);
    });

    test('rejects a plan whose audited facts were changed after planning', () => {
        const plan = buildCutoverPlan({ audit, mapping });

        expect(() =>
            parseCutoverPlan({
                ...plan,
                audit: {
                    ...plan.audit,
                    global: {
                        ...plan.audit.global,
                        accountCount: 2,
                    },
                },
            })
        ).toThrow('digest');
    });
});

import { describe, expect, test } from 'bun:test';
import {
    assertCutoverAuditMatchesMapping,
    buildCutoverPlan,
    type CutoverAudit,
    expectedIdentitySetFingerprint,
    fingerprint,
    mappingFingerprint,
    parseCutoverMapping,
    parseCutoverPlan,
} from './central-auth-cutover-lib';

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
        legacyOwnership: {
            etsyApiCallEventCount: 0,
            orphanAccountCount: 0,
            systemEtsyApiCallEventCount: 0,
            trackedKeywordCount: 0,
            trackedListingCount: 0,
            unmatchedIdentityCount: 0,
        },
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

    test('accepts retained and retired identities from different issuers', () => {
        expect(mapping.retained.issuer).not.toBe(mapping.retiredIdentities[0]?.issuer);
        expect(() => assertCutoverAuditMatchesMapping({ audit, mapping })).not.toThrow();
    });

    test('rejects a fingerprint that rewrites the retired identity issuer', () => {
        const target = audit.target;
        const retiredIdentity = mapping.retiredIdentities[0];

        if (!(target && retiredIdentity)) {
            throw new Error('Test fixtures must include a target and retired identity.');
        }

        const rewrittenFingerprint = fingerprint(
            [
                `${mapping.retained.issuer}:${mapping.retained.subject}`,
                `${mapping.retained.issuer}:${retiredIdentity.subject}`,
            ]
                .sort()
                .join('\n')
        );

        expect(() =>
            assertCutoverAuditMatchesMapping({
                audit: {
                    ...audit,
                    target: {
                        ...target,
                        identitySetFingerprint: rewrittenFingerprint,
                    },
                },
                mapping,
            })
        ).toThrow('issuer/subject set changed');
    });

    test('rejects a mapping that retains and retires the same exact identity', () => {
        expect(() =>
            parseCutoverMapping({
                ...mapping,
                retiredIdentities: [
                    {
                        issuer: mapping.retained.issuer,
                        subject: mapping.retained.subject,
                    },
                ],
            })
        ).toThrow();
    });

    test('rejects duplicate exact retired identities', () => {
        const retiredIdentity = mapping.retiredIdentities[0];

        expect(() =>
            parseCutoverMapping({
                ...mapping,
                retiredIdentities: [retiredIdentity, retiredIdentity],
            })
        ).toThrow('duplicate issuer/subject pairs');
    });

    test('rejects the retired shared-issuer mapping shape', () => {
        expect(() =>
            parseCutoverMapping({
                ...mapping,
                issuer: mapping.retained.issuer,
                retiredIdentities: undefined,
                retiredSubjects: ['user_retired'],
            })
        ).toThrow();
    });

    test('fails closed when a legacy ownership value is not tied to its account', () => {
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
                        legacyOwnership: {
                            ...target.legacyOwnership,
                            unmatchedIdentityCount: 1,
                        },
                    },
                },
                mapping,
            })
        ).toThrow('do not match identities');
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

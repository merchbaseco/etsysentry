import { createHash } from 'node:crypto';
import { z } from 'zod';

const accountIdSchema = z.string().min(1).max(200);
const issuerSchema = z.string().url();
const subjectSchema = z.string().regex(/^user_[A-Za-z0-9_-]+$/);
const merchbaseUserIdSchema = z.string().regex(/^mbu_[A-Za-z0-9_-]+$/);
const fingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/);
const nonNegativeCountSchema = z.number().int().nonnegative().safe();
const identitySchema = z
    .object({
        issuer: issuerSchema,
        subject: subjectSchema,
    })
    .strict();

type CutoverIdentity = z.infer<typeof identitySchema>;

const identityKey = (identity: CutoverIdentity): string => `${identity.issuer}:${identity.subject}`;

export const fingerprint = (value: string): string => {
    return createHash('sha256').update(value, 'utf8').digest('hex');
};

export const cutoverMappingSchema = z
    .object({
        accountId: accountIdSchema,
        merchbaseUserId: merchbaseUserIdSchema,
        retained: identitySchema.extend({
            sourceUpdatedAt: z.number().int().positive().safe(),
            access: z.enum(['granted', 'not_granted']),
            accessValidUntil: z.string().datetime({ offset: true }).nullable(),
        }),
        retiredIdentities: z.array(identitySchema).min(1),
        expected: z.object({
            global: z
                .object({
                    accountCount: nonNegativeCountSchema,
                    activeLegacyApiKeyCount: nonNegativeCountSchema,
                    clerkIdentityCount: nonNegativeCountSchema,
                    duplicateNormalizedEmailGroupCount: nonNegativeCountSchema,
                    etsyOAuthConnectionCount: nonNegativeCountSchema,
                })
                .strict(),
            target: z
                .object({
                    accountIdentityCount: nonNegativeCountSchema,
                    activeLegacyApiKeyCount: nonNegativeCountSchema,
                    etsyOAuthConnectionCount: nonNegativeCountSchema,
                    legacyOwnershipReferenceCount: nonNegativeCountSchema,
                    systemEtsyApiCallEventCount: nonNegativeCountSchema,
                })
                .strict(),
        }),
    })
    .strict()
    .superRefine((mapping, context) => {
        const retainedKey = identityKey(mapping.retained);
        const retiredKeys = mapping.retiredIdentities.map(identityKey);

        if (retiredKeys.includes(retainedKey)) {
            context.addIssue({
                code: 'custom',
                message: 'retained identity must not also appear in retiredIdentities.',
                path: ['retiredIdentities'],
            });
        }

        if (new Set(retiredKeys).size !== retiredKeys.length) {
            context.addIssue({
                code: 'custom',
                message: 'retiredIdentities must not contain duplicate issuer/subject pairs.',
                path: ['retiredIdentities'],
            });
        }
    });

export type CutoverMapping = z.infer<typeof cutoverMappingSchema>;

const productRowCountsSchema = z
    .object({
        currencyRates: nonNegativeCountSchema,
        etsyApiCallEvents: nonNegativeCountSchema,
        etsyOAuthConnections: nonNegativeCountSchema,
        eventLogs: nonNegativeCountSchema,
        listingMetricSnapshots: nonNegativeCountSchema,
        listingTags: nonNegativeCountSchema,
        productKeywordRanks: nonNegativeCountSchema,
        tags: nonNegativeCountSchema,
        trackedKeywords: nonNegativeCountSchema,
        trackedListings: nonNegativeCountSchema,
        trackedShopListings: nonNegativeCountSchema,
        trackedShopSnapshots: nonNegativeCountSchema,
        trackedShops: nonNegativeCountSchema,
    })
    .strict();

export type ProductRowCounts = z.infer<typeof productRowCountsSchema>;

const legacyOwnershipAuditSchema = z
    .object({
        etsyApiCallEventCount: nonNegativeCountSchema,
        orphanAccountCount: nonNegativeCountSchema,
        systemEtsyApiCallEventCount: nonNegativeCountSchema,
        trackedKeywordCount: nonNegativeCountSchema,
        trackedListingCount: nonNegativeCountSchema,
        unmatchedIdentityCount: nonNegativeCountSchema,
    })
    .strict();

export type LegacyOwnershipAudit = z.infer<typeof legacyOwnershipAuditSchema>;

export const cutoverAuditSchema = z
    .object({
        global: z
            .object({
                accountCount: nonNegativeCountSchema,
                activeLegacyApiKeyCount: nonNegativeCountSchema,
                clerkIdentityCount: nonNegativeCountSchema,
                duplicateNormalizedEmailGroupCount: nonNegativeCountSchema,
                etsyOAuthConnectionCount: nonNegativeCountSchema,
            })
            .strict(),
        target: z
            .object({
                accountRowCount: nonNegativeCountSchema,
                activeLegacyApiKeyCount: nonNegativeCountSchema,
                etsyOAuthConnectionCount: nonNegativeCountSchema,
                identityCount: nonNegativeCountSchema,
                identitySetFingerprint: fingerprintSchema,
                legacyOwnership: legacyOwnershipAuditSchema,
                productRowCounts: productRowCountsSchema,
            })
            .strict()
            .nullable(),
    })
    .strict();

export type CutoverAudit = z.infer<typeof cutoverAuditSchema>;

const cutoverPlanSchema = z
    .object({
        version: z.literal(1),
        service: z.literal('etsysentry'),
        mappingFingerprint: fingerprintSchema,
        audit: cutoverAuditSchema,
        planDigest: fingerprintSchema,
    })
    .strict();

export type CutoverPlan = z.infer<typeof cutoverPlanSchema>;

export const parseCutoverMapping = (value: unknown): CutoverMapping => {
    return cutoverMappingSchema.parse(value);
};

export const parseCutoverPlan = (value: unknown): CutoverPlan => {
    const plan = cutoverPlanSchema.parse(value);
    const { planDigest, ...planWithoutDigest } = plan;

    if (fingerprint(JSON.stringify(planWithoutDigest)) !== planDigest) {
        throw new Error('Cutover plan digest does not match its audited facts.');
    }

    return plan;
};

export const mappingFingerprint = (mapping: CutoverMapping): string => {
    return fingerprint(
        JSON.stringify({
            accountId: mapping.accountId,
            merchbaseUserId: mapping.merchbaseUserId,
            retained: mapping.retained,
            retiredIdentities: [...mapping.retiredIdentities].sort((left, right) =>
                identityKey(left).localeCompare(identityKey(right))
            ),
            expected: mapping.expected,
        })
    );
};

export const expectedIdentitySetFingerprint = (mapping: CutoverMapping): string => {
    return fingerprint(
        [mapping.retained, ...mapping.retiredIdentities].map(identityKey).sort().join('\n')
    );
};

export const buildCutoverPlan = (params: {
    audit: CutoverAudit;
    mapping: CutoverMapping;
}): CutoverPlan => {
    const planWithoutDigest = {
        version: 1 as const,
        service: 'etsysentry' as const,
        mappingFingerprint: mappingFingerprint(params.mapping),
        audit: params.audit,
    };

    return {
        ...planWithoutDigest,
        planDigest: fingerprint(JSON.stringify(planWithoutDigest)),
    };
};

export const assertCutoverAuditMatchesMapping = (params: {
    audit: CutoverAudit;
    mapping: CutoverMapping;
}): void => {
    const target = params.audit.target;

    if (!target) {
        throw new Error('Cutover audit did not include a target account.');
    }

    if (target.accountRowCount !== 1) {
        throw new Error('Cutover requires exactly one local account row for the supplied mapping.');
    }

    if (JSON.stringify(params.audit.global) !== JSON.stringify(params.mapping.expected.global)) {
        throw new Error('Global cutover counts changed; obtain a fresh explicit mapping.');
    }

    if (target.identityCount !== params.mapping.expected.target.accountIdentityCount) {
        throw new Error('Clerk identity count changed; obtain a fresh explicit mapping.');
    }

    if (target.identitySetFingerprint !== expectedIdentitySetFingerprint(params.mapping)) {
        throw new Error('Clerk issuer/subject set changed; no identity winner was inferred.');
    }

    if (target.activeLegacyApiKeyCount !== params.mapping.expected.target.activeLegacyApiKeyCount) {
        throw new Error('Active legacy API-key count changed; obtain a fresh explicit mapping.');
    }

    if (
        target.etsyOAuthConnectionCount !== params.mapping.expected.target.etsyOAuthConnectionCount
    ) {
        throw new Error('Etsy OAuth connection count changed; obtain a fresh explicit mapping.');
    }

    const legacyOwnershipReferenceCount =
        target.legacyOwnership.etsyApiCallEventCount +
        target.legacyOwnership.trackedKeywordCount +
        target.legacyOwnership.trackedListingCount;

    if (
        legacyOwnershipReferenceCount !==
        params.mapping.expected.target.legacyOwnershipReferenceCount
    ) {
        throw new Error(
            'Legacy ownership reference count changed; obtain a fresh explicit mapping.'
        );
    }

    if (
        target.legacyOwnership.systemEtsyApiCallEventCount !==
        params.mapping.expected.target.systemEtsyApiCallEventCount
    ) {
        throw new Error('System metering count changed; obtain a fresh explicit mapping.');
    }

    if (target.legacyOwnership.orphanAccountCount > 0) {
        throw new Error('Legacy ownership rows exist without an owning local account.');
    }

    if (target.legacyOwnership.unmatchedIdentityCount > 0) {
        throw new Error('Legacy ownership values do not match identities on their local account.');
    }

    if (
        target.legacyOwnership.etsyApiCallEventCount !==
            target.productRowCounts.etsyApiCallEvents ||
        target.legacyOwnership.trackedKeywordCount !== target.productRowCounts.trackedKeywords ||
        target.legacyOwnership.trackedListingCount !== target.productRowCounts.trackedListings
    ) {
        throw new Error('Legacy ownership audit does not match preserved product row counts.');
    }
};

export const accessValidUntilEpoch = (value: string | null): number | null => {
    if (value === null) {
        return null;
    }

    const epoch = Date.parse(value);

    if (!Number.isSafeInteger(epoch) || epoch < 0) {
        throw new Error('retained.accessValidUntil must be a valid ISO timestamp.');
    }

    return epoch;
};

export interface PhaseTwoReadiness {
    accountWithInvalidActiveProjectionCount: number;
    invalidLegacyProjectionCount: number;
    mappedAccountCount: number;
    orphanOwnershipReferenceCount: number;
    unmappedAccountCount: number;
    unmatchedIdentityReferenceCount: number;
    unprojectedIdentityCount: number;
}

export const assertPhaseTwoReadiness = (readiness: PhaseTwoReadiness): void => {
    if (readiness.unmappedAccountCount > 0) {
        throw new Error('Central access phase two requires every account to be backfilled.');
    }

    if (readiness.mappedAccountCount === 0) {
        throw new Error('Central access phase two requires at least one mapped account.');
    }

    if (readiness.accountWithInvalidActiveProjectionCount > 0) {
        throw new Error(
            'Central access phase two requires exactly one retained active identity per account.'
        );
    }

    if (readiness.unprojectedIdentityCount > 0) {
        throw new Error('Central access phase two requires every Clerk identity to be projected.');
    }

    if (readiness.invalidLegacyProjectionCount > 0) {
        throw new Error(
            'Central access phase two requires valid retained or terminal legacy projections.'
        );
    }

    if (readiness.orphanOwnershipReferenceCount > 0) {
        throw new Error(
            'Central access phase two found product or metering rows without an owning account.'
        );
    }

    if (readiness.unmatchedIdentityReferenceCount > 0) {
        throw new Error(
            'Central access phase two found legacy ownership values not tied to their account.'
        );
    }
};

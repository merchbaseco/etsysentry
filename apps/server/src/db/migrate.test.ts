import { describe, expect, test } from 'bun:test';
import {
    assertPhaseTwoReadiness,
    type PhaseTwoReadiness,
} from './central-access-migration-readiness';

const ready: PhaseTwoReadiness = {
    accountWithInvalidActiveProjectionCount: 0,
    invalidLegacyProjectionCount: 0,
    mappedAccountCount: 1,
    orphanOwnershipReferenceCount: 0,
    unmatchedIdentityReferenceCount: 0,
    unmappedAccountCount: 0,
    unprojectedIdentityCount: 0,
};

describe('central access phase-two readiness', () => {
    test('accepts fully mapped accounts and proven redundant legacy ownership fields', () => {
        expect(() => assertPhaseTwoReadiness(ready)).not.toThrow();
    });

    test.each([
        ['accountWithInvalidActiveProjectionCount', 'exactly one retained active identity'],
        ['invalidLegacyProjectionCount', 'valid retained or terminal'],
        ['orphanOwnershipReferenceCount', 'without an owning account'],
        ['unmatchedIdentityReferenceCount', 'not tied to their account'],
        ['unmappedAccountCount', 'every account'],
        ['unprojectedIdentityCount', 'every Clerk identity'],
    ] as const)('rejects nonzero %s', (field, message) => {
        expect(() =>
            assertPhaseTwoReadiness({
                ...ready,
                [field]: 1,
            })
        ).toThrow(message);
    });

    test('rejects cleanup when no mapped account exists', () => {
        expect(() =>
            assertPhaseTwoReadiness({
                ...ready,
                mappedAccountCount: 0,
            })
        ).toThrow('at least one mapped account');
    });
});

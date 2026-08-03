import { describe, expect, test } from 'bun:test';
import { parseClerkUserProjection, projectionGrantsAccess } from '@merchbaseco/access';

const projectionInput = {
    issuer: 'https://clerk.example',
    subject: 'user_test',
    sourceUpdatedAt: 100,
    publicMetadata: {
        merchbase: {
            userId: 'mbu_test',
            access: 'granted',
            accessValidUntil: null,
        },
    },
};

describe('central access contract', () => {
    test('parses the stable user projection used by EtsySentry', () => {
        expect(parseClerkUserProjection(projectionInput)).toEqual({
            issuer: 'https://clerk.example',
            subject: 'user_test',
            merchbaseUserId: 'mbu_test',
            access: 'granted',
            accessValidUntil: null,
            sourceUpdatedAt: 100,
        });
    });

    test('fails closed for malformed central metadata', () => {
        expect(
            parseClerkUserProjection({
                ...projectionInput,
                publicMetadata: {},
            })
        ).toBeNull();
    });

    test('enforces projection access expiry locally', () => {
        const projection = parseClerkUserProjection({
            ...projectionInput,
            publicMetadata: {
                merchbase: {
                    userId: 'mbu_test',
                    access: 'granted',
                    accessValidUntil: '1970-01-01T00:00:01.000Z',
                },
            },
        });

        expect(projection).not.toBeNull();
        if (!projection) {
            throw new Error('Expected a parsed access projection.');
        }

        expect(projectionGrantsAccess(projection, 1000)).toBe(false);
    });
});

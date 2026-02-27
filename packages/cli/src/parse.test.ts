import { describe, expect, test } from 'bun:test';
import { resolveCommand } from './parse.js';

describe('resolveCommand', () => {
    test('maps track product alias to listings track', () => {
        expect(resolveCommand(['track', 'product', '123'])).toEqual({
            args: ['123'],
            resource: 'listings',
            verb: 'track',
        });
    });

    test('maps products alias to listings resource', () => {
        expect(resolveCommand(['products', 'list'])).toEqual({
            args: [],
            resource: 'listings',
            verb: 'list',
        });
    });

    test('returns null for unsupported track alias target', () => {
        expect(resolveCommand(['track', 'unknown', 'x'])).toBeNull();
    });
});

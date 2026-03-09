import { describe, expect, test } from 'bun:test';
import { parseCliInput, resolveCommand } from './parse.js';

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

    test('maps changelog to the metadata command', () => {
        expect(resolveCommand(['changelog'])).toEqual({
            args: [],
            resource: 'meta',
            verb: 'changelog',
        });
    });
});

describe('parseCliInput', () => {
    test('parses the version flag', () => {
        expect(parseCliInput(['--version'])).toEqual({
            flags: {
                apiKey: undefined,
                baseUrl: undefined,
                help: false,
                limit: undefined,
                metrics: undefined,
                mode: undefined,
                offset: undefined,
                range: undefined,
                search: undefined,
                showDigital: false,
                syncState: undefined,
                trackingState: undefined,
                version: true,
            },
            positionals: [],
        });
    });
});

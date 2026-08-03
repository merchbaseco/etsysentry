import { describe, expect, test } from 'bun:test';
import { createRequestHeaders } from './index';

describe('createRequestHeaders', () => {
    test('sends the shared opaque key as a bearer credential', () => {
        expect(createRequestHeaders({ apiKey: '  ak_test  ' })).toEqual({
            Authorization: 'Bearer ak_test',
        });
    });

    test('does not emit the removed customer API-key header', () => {
        expect(createRequestHeaders({ apiKey: 'ak_test' })).not.toHaveProperty('x-api-key');
    });
});

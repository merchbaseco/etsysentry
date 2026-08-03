import { describe, expect, test } from 'bun:test';
import { isAdminMerchbaseUser } from './context';

describe('context admin identity matching', () => {
    test('matches only the configured stable Merchbase user ID', () => {
        expect(isAdminMerchbaseUser('mbu_admin', 'mbu_admin')).toBe(true);
        expect(isAdminMerchbaseUser('mbu_other', 'mbu_admin')).toBe(false);
    });

    test('fails closed when no stable admin identity is configured', () => {
        expect(isAdminMerchbaseUser('mbu_admin', undefined)).toBe(false);
    });
});

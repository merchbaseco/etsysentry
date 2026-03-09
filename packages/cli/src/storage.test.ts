import { describe, expect, test } from 'bun:test';
import { homedir } from 'node:os';
import path from 'node:path';
import { normalizeStorageDir, resolveConfigPath } from './storage.js';

describe('normalizeStorageDir', () => {
    test('resolves relative paths from the current working directory', () => {
        expect(normalizeStorageDir('./tmp/cli-data')).toBe(path.resolve('./tmp/cli-data'));
    });

    test('expands the home directory shortcut', () => {
        expect(normalizeStorageDir('~/cli-data')).toBe(path.join(homedir(), 'cli-data'));
    });

    test('throws when the value is empty', () => {
        expect(() => normalizeStorageDir('   ')).toThrow('Storage directory cannot be empty.');
    });
});

describe('resolveConfigPath', () => {
    test('appends the config filename inside the storage directory', () => {
        expect(resolveConfigPath('/tmp/cli-data')).toBe('/tmp/cli-data/config.json');
    });
});

import { describe, expect, test } from 'bun:test';
import { runMetaCommand } from './commands-meta.js';
import { loadChangelog } from './metadata.js';

describe('runMetaCommand', () => {
    test('returns the project changelog text', async () => {
        const result = await runMetaCommand({
            args: [],
            resource: 'meta',
            verb: 'changelog',
        });

        expect(result).toEqual({
            text: await loadChangelog(),
            type: 'text',
        });
    });
});

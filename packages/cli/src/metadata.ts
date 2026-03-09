import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { failWith } from './errors.js';

interface CliPackageJson {
    version: string;
}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_PACKAGE_JSON_PATH = path.resolve(MODULE_DIR, '../package.json');
const CHANGELOG_PATH = path.resolve(MODULE_DIR, '../../../CHANGELOG.md');

const parseCliPackageJson = (value: unknown): CliPackageJson => {
    if (!value || typeof value !== 'object') {
        failWith({
            code: 'INTERNAL_ERROR',
            message: 'CLI package metadata is invalid.',
        });

        throw new Error('Unreachable');
    }

    const packageJson = value as Partial<CliPackageJson>;
    const version = packageJson.version;

    if (typeof version === 'string' && version.length > 0) {
        return {
            version,
        };
    }

    failWith({
        code: 'INTERNAL_ERROR',
        message: 'CLI package metadata is invalid.',
    });

    throw new Error('Unreachable');
};

export const loadCliVersion = async (): Promise<string> => {
    let packageJson: string;

    try {
        packageJson = await readFile(CLI_PACKAGE_JSON_PATH, 'utf8');
    } catch {
        failWith({
            code: 'INTERNAL_ERROR',
            message: 'Unable to load CLI version metadata.',
        });

        throw new Error('Unreachable');
    }

    let parsed: unknown;

    try {
        parsed = JSON.parse(packageJson) as unknown;
    } catch {
        failWith({
            code: 'INTERNAL_ERROR',
            message: 'Unable to load CLI version metadata.',
        });

        throw new Error('Unreachable');
    }

    return parseCliPackageJson(parsed).version;
};

export const loadChangelog = async (): Promise<string> => {
    try {
        return await readFile(CHANGELOG_PATH, 'utf8');
    } catch {
        failWith({
            code: 'INTERNAL_ERROR',
            message: 'Unable to load the project changelog.',
        });

        throw new Error('Unreachable');
    }
};

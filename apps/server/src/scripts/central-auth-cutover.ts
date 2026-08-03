import { readFile, writeFile } from 'node:fs/promises';
import { TERMINAL_PROJECTION_TIMESTAMP } from '@merchbaseco/access';
import postgres from 'postgres';
import { env } from '../config/env';
import { backfillCutover, loadCutoverAudit } from './central-auth-cutover-db';
import {
    assertCutoverAuditMatchesMapping,
    buildCutoverPlan,
    fingerprint,
    parseCutoverMapping,
    parseCutoverPlan,
} from './central-auth-cutover-lib';

type CutoverCommand = 'audit' | 'plan' | 'backfill';

interface ParsedArguments {
    command: CutoverCommand;
    values: Map<string, string>;
}

const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/;

const parseArguments = (argv: string[]): ParsedArguments => {
    const command = argv[0];

    if (command !== 'audit' && command !== 'plan' && command !== 'backfill') {
        throw new Error('Usage: central-auth-cutover.ts <audit|plan|backfill> [options].');
    }

    const values = new Map<string, string>();

    for (let index = 1; index < argv.length; index += 1) {
        const argument = argv[index];

        if (!argument?.startsWith('--')) {
            throw new Error('Cutover options must use --name value form.');
        }

        const value = argv[index + 1];

        if (!value || value.startsWith('--')) {
            throw new Error(`Missing value for ${argument}.`);
        }

        values.set(argument.slice(2), value);
        index += 1;
    }

    return {
        command,
        values,
    };
};

const requiredValue = (values: Map<string, string>, name: string): string => {
    const value = values.get(name)?.trim();

    if (!value) {
        throw new Error(`--${name} is required.`);
    }

    return value;
};

const readJsonFile = async (path: string): Promise<unknown> => {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
};

const openDatabase = () =>
    postgres({
        database: env.databaseName,
        host: env.databaseHost,
        max: 1,
        password: env.databasePassword,
        port: env.databasePort,
        user: env.databaseUser,
    });

const runAudit = async (values: Map<string, string>): Promise<void> => {
    const mappingPath = values.get('mapping');
    const mapping = mappingPath ? parseCutoverMapping(await readJsonFile(mappingPath)) : undefined;
    const database = openDatabase();

    try {
        await database.begin(async (transaction) => {
            const readOnlyDatabase = transaction as unknown as typeof database;
            await readOnlyDatabase`SET TRANSACTION READ ONLY`;
            const audit = await loadCutoverAudit(readOnlyDatabase, mapping);

            if (mapping) {
                assertCutoverAuditMatchesMapping({ audit, mapping });
            }

            console.log(JSON.stringify(audit, null, 2));
        });
    } finally {
        await database.end();
    }
};

const runPlan = async (values: Map<string, string>): Promise<void> => {
    const mapping = parseCutoverMapping(await readJsonFile(requiredValue(values, 'mapping')));
    const database = openDatabase();

    try {
        const audit = await database.begin(async (transaction) => {
            const readOnlyDatabase = transaction as unknown as typeof database;
            await readOnlyDatabase`SET TRANSACTION READ ONLY`;
            return loadCutoverAudit(readOnlyDatabase, mapping);
        });
        assertCutoverAuditMatchesMapping({ audit, mapping });
        const plan = buildCutoverPlan({ audit, mapping });
        const outputPath = values.get('out');

        if (outputPath) {
            await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
        }

        console.log(JSON.stringify(plan, null, 2));
    } finally {
        await database.end();
    }
};

const runBackfill = async (values: Map<string, string>): Promise<void> => {
    const mapping = parseCutoverMapping(await readJsonFile(requiredValue(values, 'mapping')));
    const plan = parseCutoverPlan(await readJsonFile(requiredValue(values, 'plan')));
    const backupFingerprint = requiredValue(values, 'backup-fingerprint');
    const approvedBy = requiredValue(values, 'approved-by');

    if (!SHA256_HEX_REGEX.test(backupFingerprint)) {
        throw new Error('--backup-fingerprint must be a SHA-256 hex fingerprint.');
    }

    if (approvedBy.includes('\n') || approvedBy.includes('\r')) {
        throw new Error('--approved-by must be a single line.');
    }

    const database = openDatabase();

    try {
        await backfillCutover({
            database,
            mapping,
            plan,
        });

        console.log(
            JSON.stringify(
                {
                    approvedByFingerprint: fingerprint(approvedBy),
                    backupFingerprint,
                    projectionTombstoneTimestamp: TERMINAL_PROJECTION_TIMESTAMP,
                    service: 'etsysentry',
                    status: 'backfilled',
                },
                null,
                2
            )
        );
    } finally {
        await database.end();
    }
};

const redactError = (error: unknown): string => {
    const message = error instanceof Error ? error.message : 'Unexpected cutover failure.';

    return message
        .replace(/user_[A-Za-z0-9_-]+/g, '<redacted-subject>')
        .replace(/mbu_[A-Za-z0-9_-]+/g, '<redacted-user>')
        .replace(/https?:\/\/[^\s/]+[^\s]*/g, '<redacted-issuer>');
};

const main = async (): Promise<void> => {
    const parsed = parseArguments(process.argv.slice(2));

    if (parsed.command === 'audit') {
        await runAudit(parsed.values);
        return;
    }

    if (parsed.command === 'plan') {
        await runPlan(parsed.values);
        return;
    }

    await runBackfill(parsed.values);
};

if (import.meta.main) {
    try {
        await main();
    } catch (error) {
        console.error(redactError(error));
        process.exitCode = 1;
    }
}

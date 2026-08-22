import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Deploy-time guard: name-diffs the environment Docker baked into the running
 * server container against the schema's sensitivity split.
 *
 * For a Compose service the platform's "delivered copy" is the container spec
 * Docker writes at `up` time, so that is what gets inspected. Values are read
 * into this process (they are part of the inspect output) but are split off at
 * the first `=` and never printed, logged, or returned — only names leave.
 *
 * Fails when a delivered name is not a schema item (a stale name surviving a
 * rename), or when a production-required sensitive item never reached the
 * container.
 */
const containerName = 'etsysentry-server';

// Names the oven/bun runtime image sets for itself rather than receiving from
// the schema; they are not part of the environment contract. NODE_ENV is here
// deliberately: it is the in-container lifecycle signal precisely because
// VARLOCK_ENV is a varlock builtin and is never delivered.
const imageProvidedNames = new Set([
    'PATH',
    'NODE_ENV',
    'BUN_INSTALL_BIN',
    'BUN_RUNTIME_TRANSPILER_CACHE_PATH',
    'HOSTNAME',
    'HOME',
    'TERM',
]);

const itemPattern = /^([A-Z][A-Z0-9_]*)=/u;
const requiredPattern = / @required(\s|$)/u;

const schema = readFileSync('.env.schema', 'utf8');
const declared = new Set<string>();
const sensitive = new Set<string>();
const requiredInProduction = new Set<string>();

let decorators = '';
for (const line of schema.split('\n')) {
    if (line.startsWith('#')) {
        decorators += ` ${line}`;
        continue;
    }
    const item = itemPattern.exec(line);
    if (item) {
        const name = item[1];
        if (!decorators.includes('@internal')) {
            declared.add(name);
            if (decorators.includes('@sensitive')) {
                sensitive.add(name);
                if (
                    requiredPattern.test(decorators) ||
                    decorators.includes('@required=forEnv(production')
                ) {
                    requiredInProduction.add(name);
                }
            }
        }
    }
    decorators = '';
}

// JSON rather than a newline-delimited format: a delivered value may itself
// contain newlines (a PEM public key does), and splitting the flat output on
// newlines would turn each continuation line into a bogus variable name.
const inspected = spawnSync(
    'docker',
    ['inspect', containerName, '--format', '{{json .Config.Env}}'],
    { encoding: 'utf8', env: process.env }
);

if (inspected.status !== 0) {
    console.error(`Unable to inspect the ${containerName} container.`);
    console.error(inspected.stderr ?? '');
    process.exit(1);
}

let entries: string[];
try {
    entries = JSON.parse(inspected.stdout ?? '[]') as string[];
} catch {
    console.error(`Could not parse the environment of the ${containerName} container.`);
    process.exit(1);
}

// Split at the first `=` and discard the value immediately.
const deliveredNames = entries
    .map((entry) => entry.slice(0, entry.indexOf('=')))
    .filter((name) => name.length > 0 && !imageProvidedNames.has(name));

const failures: string[] = [];

for (const name of deliveredNames) {
    if (!declared.has(name)) {
        failures.push(
            `Delivered variable ${name} is not a deliverable .env.schema item (stale name?).`
        );
    }
}

for (const name of [...requiredInProduction].sort()) {
    if (!deliveredNames.includes(name)) {
        failures.push(`Production-required sensitive item ${name} never reached the container.`);
    }
}

if (failures.length > 0) {
    for (const failure of failures) {
        console.error(failure);
    }
    process.exit(1);
}

const deliveredSensitive = deliveredNames.filter((name) => sensitive.has(name)).length;

console.log(
    `Delivered environment matches the schema: ${deliveredNames.length} variables in ${containerName} (${deliveredSensitive} sensitive, ${requiredInProduction.size} production-required verified).`
);

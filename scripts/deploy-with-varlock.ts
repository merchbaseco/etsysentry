import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';

/**
 * The production deploy runs under the deploy-agent role: every venue that
 * deploys supplies its own 1Password identity under
 * DEPLOY_AGENT_PRODUCTION_OP_TOKEN. The self-hosted GitHub Actions runner on
 * the Mac mini injects the GitHub deploy agent's token as a repository secret —
 * the preferred path, identical to the Workers repos. When no identity is
 * present this is a supervised operator run, so the script re-execs itself
 * under `op run`, resolving the Mac Mini identity through 1Password desktop
 * authorization.
 *
 * Delivery is Docker Compose: the schema is resolved into the process
 * environment and Compose interpolates `${VAR}` from there. No `--env-file` and
 * no generated plaintext env file is involved anywhere in this path.
 *
 * Runtime steps run under `varlock run`. The image build cannot, because
 * `varlock run` strips @internal items and the build needs the install token —
 * so it gets an explicitly constructed environment instead.
 */
const bootstrapName = 'DEPLOY_AGENT_PRODUCTION_OP_TOKEN';
const operatorIdentity = 'op://Automation/Production Varlock - Mac Mini/credential';
const installTokenName = 'MERCHBASE_GITHUB_NPM_TOKEN';
const projectName = 'etsysentry';
const argPattern = /^ARG\s+([A-Z][A-Z0-9_]*)/gmu;
const composeServicePattern = /^ {2}([a-z][a-z0-9-]*):$/gmu;

const dryRun = process.argv.includes('--dry-run');

const binDirectories = [
    join(process.cwd(), 'node_modules', '.bin'),
    join(process.cwd(), 'apps', 'server', 'node_modules', '.bin'),
];

const environment: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: [...binDirectories, process.env.PATH ?? ''].join(delimiter),
    // The schema's `@currentEnv=$VARLOCK_ENV` otherwise falls back to varlock's
    // own inference, which resolves `development` anywhere outside CI. That
    // would deliver Development-vault credentials to the production stack, so
    // the production lifecycle is pinned here rather than left to the
    // operator's shell.
    VARLOCK_ENV: 'production',
};

if (!process.env[bootstrapName]) {
    const reexec = spawnSync(
        'op',
        ['run', '--', 'bun', process.argv[1] ?? '', ...process.argv.slice(2)],
        {
            env: { ...environment, [bootstrapName]: operatorIdentity },
            stdio: 'inherit',
        }
    );
    process.exit(reexec.status ?? 1);
}

const varlockRun = (args: string[], env = environment) =>
    spawnSync('bunx', ['varlock', 'run', '--', ...args], { env, stdio: 'inherit' });

const printenv = (name: string, extraEnv: NodeJS.ProcessEnv = {}) => {
    const fetched = spawnSync('bunx', ['varlock', 'printenv', name], {
        env: { ...environment, ...extraEnv },
        encoding: 'utf8',
    });
    return fetched.status === 0 ? (fetched.stdout ?? '').trim() : '';
};

// The Docker build installs the private @merchbaseco/* packages through a
// BuildKit secret mount, which Compose reads from the process environment. On
// the Actions runner the workflow supplies the token from `github.token`, which
// is the preferred path and needs no 1Password access at all.
//
// The operator fallback resolves it from the Development vault, NOT the
// production lifecycle: install credentials belong to the development
// lifecycle, and under VARLOCK_ENV=production the development 1Password client
// has no usable authentication (its bootstrap is empty and `allowAppAuth` is
// false), so an op(development, ...) reference cannot resolve there.
if (!environment[installTokenName]) {
    const token = printenv(installTokenName, {
        VARLOCK_ENV: 'development',
        ETSYSENTRY_RESOLVE_INSTALL_TOKENS: 'true',
    });
    if (token) {
        environment[installTokenName] = token;
    }
}
if (!environment[installTokenName]) {
    console.error(
        `${installTokenName} did not resolve; the image build cannot install private packages.`
    );
    process.exit(1);
}

// `varlock run` strips @internal items from the child environment, so the image
// build cannot run under it: Compose would see an empty BuildKit secret and the
// private-package install would fail. Build with an explicit environment
// instead. Every website build argument is @public, and the ARG list in the
// Dockerfile is the single source for which ones exist — `bun run env:contract`
// keeps it in step with compose.
const buildEnvironment: NodeJS.ProcessEnv = { ...environment };
const buildArgNames = [...readFileSync('Dockerfile', 'utf8').matchAll(argPattern)].map(
    (match) => match[1]
);

for (const name of buildArgNames) {
    buildEnvironment[name] = printenv(name);
}

const composeArgs = ['-p', projectName];

// Dry run stops here: rendering the Compose configuration forces every op()
// reference in the schema to resolve and every `${VAR}` in compose.yml to
// interpolate, so a missing 1Password item or an unset name fails before
// anything is built or replaced.
if (dryRun) {
    const rendered = spawnSync(
        'bunx',
        ['varlock', 'run', '--', 'docker', 'compose', ...composeArgs, 'config'],
        { env: buildEnvironment, encoding: 'utf8' }
    );
    if (rendered.status !== 0) {
        console.error('Dry run failed to render the Compose configuration.');
        console.error(rendered.stderr ?? '');
        process.exit(rendered.status ?? 1);
    }
    // The rendered document contains resolved secrets, so only its shape is
    // reported — never its contents.
    const services = [...(rendered.stdout ?? '').matchAll(composeServicePattern)].map(
        (match) => match[1]
    );
    console.log(
        `Dry run OK: schema resolved and Compose rendered ${services.length} services (${services.join(', ')}).`
    );
    process.exit(0);
}

// Compose parses the whole file and will warn that the server's runtime
// variables are "not set" during the build. That is expected and harmless: the
// build only needs the website build arguments and the install token, and the
// runtime values are supplied under `varlock run` at `up` time.
console.log(
    'Building images. Compose warnings about unset runtime variables are expected here — the build only consumes build arguments and the install token.'
);

const build = spawnSync('docker', ['compose', ...composeArgs, 'build'], {
    env: buildEnvironment,
    stdio: 'inherit',
});
if (build.status !== 0) {
    console.error('Image build failed; deploy not attempted.');
    process.exit(build.status ?? 1);
}

// The server applies Drizzle migrations on boot, so `up -d` is the whole
// release step.
const up = varlockRun(['docker', 'compose', ...composeArgs, 'up', '-d', '--remove-orphans']);
if (up.status !== 0) {
    process.exit(up.status ?? 1);
}

varlockRun(['docker', 'compose', ...composeArgs, 'ps']);

// Deploy-time guard: name-diff what Docker actually baked into the container
// against the schema's sensitivity split.
const verified = spawnSync('bun', ['scripts/verify-deployed-secrets.ts'], {
    env: environment,
    stdio: 'inherit',
});
process.exit(verified.status ?? 1);

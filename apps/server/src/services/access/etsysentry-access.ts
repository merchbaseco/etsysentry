import {
    type AccessProjectionStore,
    type AccessSnapshot,
    type AccessSnapshotLookup,
    type CloudflareServiceAccessOptions,
    createAccessSnapshotClient,
    createCloudflareAssertionVerifier,
    createCloudflareProjectionHandler,
    createCloudflareServiceAccess,
    ServiceAccessError,
} from '@merchbaseco/access';
import {
    assertDevCloudflareAccessTarget,
    createDevCloudflareAccess,
    DEV_ACCESS_AUTHORITY_ORIGIN,
} from '@merchbaseco/access/dev';
import { env } from '../../config/env';
import { db } from '../../db';
import { createAccessProjectionStore } from './access-projection-store';
import { resolveEtsySentryAccountPrincipal } from './account-principal';

export const ETSYSENTRY_SERVICE = 'etsysentry' as const;
export const ETSYSENTRY_UI_HOST = 'etsysentry.merchbase.co';
export const ETSYSENTRY_API_HOST = 'etsysentry-api.merchbase.co';
export const ETSYSENTRY_INTERNAL_HOST = 'etsysentry-internal.merchbase.co';
export const ETSYSENTRY_INTERNAL_SNAPSHOT_PATH = '/api/internal/access-snapshot';

export type EtsySentryAccessSurface = 'api' | 'interactive';
export type EtsySentryCredentialKind = 'api_key' | 'oauth' | 'session';

export interface EtsySentryAuthorizedRequest {
    credentialKind: EtsySentryCredentialKind;
    expiresAt: number | null;
    merchbaseUserId: string;
    principal: { accountId: string };
    service: typeof ETSYSENTRY_SERVICE;
}

export interface ServiceAccessAdapter {
    authorize: (assertion: string) => Promise<EtsySentryAuthorizedRequest>;
    evaluateAccess: (merchbaseUserId: string) => Promise<{
        merchbaseUserId: string;
        principal: { accountId: string };
        service: typeof ETSYSENTRY_SERVICE;
    }>;
    refreshAccess: (merchbaseUserId: string) => Promise<{
        merchbaseUserId: string;
        principal: { accountId: string };
        service: typeof ETSYSENTRY_SERVICE;
    }>;
}

export interface EtsySentryAccess {
    apiAccess: ServiceAccessAdapter;
    authorizeRequest: (input: {
        assertion?: string;
        host?: string;
        method?: string;
        upgrade?: boolean;
        origin?: string | string[];
        userIdHeader?: string | string[];
    }) => Promise<EtsySentryAuthorizedRequest>;
    createProjectionHandler: (
        onChanged?: (merchbaseUserId: string) => Promise<void> | void
    ) => (request: Request) => Promise<Response>;
    interactiveAccess: ServiceAccessAdapter;
    projections: ReturnType<typeof createAccessProjectionStore>;
}

type ServiceAccess = ReturnType<typeof createCloudflareServiceAccess<{ accountId: string }>>;
type DevAccess = Awaited<ReturnType<typeof createDevCloudflareAccess<{ accountId: string }>>>;
type CloudflareOrDevAccess = ServiceAccess | DevAccess;

type EtsySentryApiAccessOptions = Omit<
    CloudflareServiceAccessOptions<{ accountId: string }>,
    'acceptedPrincipalKinds' | 'maxConnectionLifetimeSeconds' | 'verifier'
> & {
    audience: string;
    loadSnapshot: (lookup: AccessSnapshotLookup) => Promise<AccessSnapshot | null>;
    projections: AccessProjectionStore;
    resolveKey?: Parameters<typeof createCloudflareAssertionVerifier>[1];
};

const normalizeHost = (host: string | undefined): string | null => {
    if (!host) {
        return null;
    }

    try {
        const url = new URL(`http://${host}`);
        if (url.host !== host || url.username || url.password || url.pathname !== '/') {
            return null;
        }
        return host;
    } catch {
        return null;
    }
};

const isLoopbackHost = (host: string | undefined): boolean => {
    const normalized = normalizeHost(host);
    if (!normalized) {
        return false;
    }

    const hostname = new URL(`http://${normalized}`).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
};

const databaseUrl = (): string => {
    const host = env.databaseHost.includes(':') ? `[${env.databaseHost}]` : env.databaseHost;
    return `postgres://${host}:${env.databasePort}/${env.databaseName}`;
};

const devEnvironment = (): Record<string, string | undefined> => ({
    ...process.env,
    NODE_ENV: env.NODE_ENV,
});

export const assertEtsySentryDevelopmentTarget = (): void => {
    if (env.NODE_ENV !== 'development') {
        return;
    }

    assertDevCloudflareAccessTarget({
        databaseUrl: databaseUrl(),
        env: devEnvironment(),
    });
};

export const isEtsySentryDevelopmentHost = (host: string | undefined): boolean =>
    env.NODE_ENV === 'development' && isLoopbackHost(host);

const rejectUnauthenticated = (): Promise<never> =>
    Promise.reject(new ServiceAccessError('unauthenticated'));

const hasInvalidOrigin = (origin: string | string[] | undefined, appOrigin: string): boolean =>
    Array.isArray(origin) || (origin !== undefined && origin !== appOrigin);

const authorizeInteractiveRequest = (params: {
    access: ServiceAccessAdapter;
    appOrigin: string;
    assertion?: string;
    origin?: string | string[];
    requireOrigin: boolean;
}): Promise<EtsySentryAuthorizedRequest> => {
    if (
        (params.requireOrigin && params.origin !== params.appOrigin) ||
        hasInvalidOrigin(params.origin, params.appOrigin)
    ) {
        return rejectUnauthenticated();
    }
    if (!params.assertion) {
        return rejectUnauthenticated();
    }
    return params.access.authorize(params.assertion);
};

const authorizeDevelopmentRequest = (params: {
    access: ServiceAccessAdapter;
    appOrigin: string;
    assertion?: string;
    origin?: string | string[];
}): Promise<EtsySentryAuthorizedRequest> => {
    if (hasInvalidOrigin(params.origin, params.appOrigin)) {
        return rejectUnauthenticated();
    }
    return params.access.authorize(params.assertion ?? '');
};

const authorizeApiRequest = (params: {
    access: ServiceAccessAdapter;
    appOrigin: string;
    assertion?: string;
    origin?: string | string[];
}): Promise<EtsySentryAuthorizedRequest> => {
    if (hasInvalidOrigin(params.origin, params.appOrigin)) {
        return rejectUnauthenticated();
    }
    if (!params.assertion) {
        return rejectUnauthenticated();
    }
    return params.access.authorize(params.assertion);
};

const adapt = (access: CloudflareOrDevAccess, kind: 'oauth' | 'session'): ServiceAccessAdapter => ({
    authorize: async (assertion) => {
        const result = await access.authorize(assertion);
        return {
            merchbaseUserId: result.merchbaseUserId,
            principal: result.principal,
            service: ETSYSENTRY_SERVICE,
            credentialKind: result.credentialKind === 'api_key' ? 'api_key' : kind,
            expiresAt: 'expiresAt' in result ? result.expiresAt : null,
        };
    },
    evaluateAccess: async (merchbaseUserId) => {
        const result = await access.evaluateAccess(merchbaseUserId);
        return {
            merchbaseUserId: result.merchbaseUserId,
            principal: result.principal,
            service: ETSYSENTRY_SERVICE,
        };
    },
    refreshAccess: async (merchbaseUserId) => {
        const result = await access.refreshAccess(merchbaseUserId);
        return {
            merchbaseUserId: result.merchbaseUserId,
            principal: result.principal,
            service: ETSYSENTRY_SERVICE,
        };
    },
});

export const createEtsySentryRequestAuthorizer =
    (params: {
        apiAccess: ServiceAccessAdapter;
        appOrigin: string;
        development?: boolean;
        interactiveAccess: ServiceAccessAdapter;
    }) =>
    (input: {
        assertion?: string;
        host?: string;
        method?: string;
        upgrade?: boolean;
        origin?: string | string[];
        userIdHeader?: string | string[];
    }): Promise<EtsySentryAuthorizedRequest> => {
        if (input.userIdHeader !== undefined) {
            return rejectUnauthenticated();
        }

        const host = normalizeHost(input.host);
        if (params.development && isLoopbackHost(host ?? undefined)) {
            return authorizeDevelopmentRequest({
                access: params.interactiveAccess,
                appOrigin: params.appOrigin,
                assertion: input.assertion,
                origin: input.origin,
            });
        }

        if (host === ETSYSENTRY_UI_HOST) {
            return authorizeInteractiveRequest({
                requireOrigin:
                    input.upgrade === true ||
                    !['GET', 'HEAD', 'OPTIONS'].includes(input.method ?? 'GET'),
                access: params.interactiveAccess,
                appOrigin: params.appOrigin,
                assertion: input.assertion,
                origin: input.origin,
            });
        }

        if (host === ETSYSENTRY_API_HOST) {
            return authorizeApiRequest({
                access: params.apiAccess,
                appOrigin: params.appOrigin,
                assertion: input.assertion,
                origin: input.origin,
            });
        }

        return rejectUnauthenticated();
    };

export const createEtsySentryApiCloudflareAccess = ({
    audience,
    now,
    resolveKey,
    ...common
}: EtsySentryApiAccessOptions) =>
    createCloudflareServiceAccess({
        ...common,
        acceptedPrincipalKinds: ['person', 'api_key'],
        maxConnectionLifetimeSeconds: 300,
        now,
        verifier: createCloudflareAssertionVerifier(
            {
                audience,
                issuer: common.issuer,
                maxMachineLifetimeSeconds: 600,
                now,
            },
            resolveKey
        ),
    });

const requireProductionValue = (_name: string, value: string | undefined): string => {
    if (!value) {
        throw new ServiceAccessError('access_unavailable');
    }
    return value;
};

const unavailableAccess = (): EtsySentryAccess => {
    const unavailable = (): Promise<never> =>
        Promise.reject(new ServiceAccessError('access_unavailable'));
    const adapter: ServiceAccessAdapter = {
        authorize: unavailable,
        evaluateAccess: unavailable,
        refreshAccess: unavailable,
    };

    return {
        apiAccess: adapter,
        authorizeRequest: unavailable,
        createProjectionHandler: () => async () => new Response(null, { status: 404 }),
        interactiveAccess: adapter,
        projections: createAccessProjectionStore(db),
    };
};

export const createEtsySentryAccess = async (
    database: typeof db = db
): Promise<EtsySentryAccess> => {
    const principalForUser = ({ merchbaseUserId }: { merchbaseUserId: string }) =>
        resolveEtsySentryAccountPrincipal({ database, merchbaseUserId });

    if (env.NODE_ENV === 'development') {
        const runtimeEnv = devEnvironment();
        const targetUrl = databaseUrl();
        assertEtsySentryDevelopmentTarget();
        const projections = createAccessProjectionStore(database, DEV_ACCESS_AUTHORITY_ORIGIN);
        const devAccess = await createDevCloudflareAccess({
            databaseUrl: targetUrl,
            env: runtimeEnv,
            projections,
            resolveServicePrincipal: principalForUser,
            service: ETSYSENTRY_SERVICE,
        });
        const interactiveAccess = adapt(devAccess, 'session');
        const apiAccess = adapt(devAccess, 'oauth');

        return {
            apiAccess,
            authorizeRequest: createEtsySentryRequestAuthorizer({
                apiAccess,
                appOrigin: env.ETSYSENTRY_APP_ORIGIN,
                development: true,
                interactiveAccess,
            }),
            createProjectionHandler: () => async () => new Response(null, { status: 404 }),
            interactiveAccess,
            projections,
        };
    }

    if (env.NODE_ENV !== 'production') {
        return unavailableAccess();
    }

    const issuer = requireProductionValue('MERCHBASE_ACCESS_ISSUER', env.MERCHBASE_ACCESS_ISSUER);
    const authorityOrigin = requireProductionValue(
        'MERCHBASE_ACCESS_AUTHORITY_ORIGIN',
        env.MERCHBASE_ACCESS_AUTHORITY_ORIGIN
    );
    const apiAudience = requireProductionValue(
        'MERCHBASE_ACCESS_API_AUDIENCE',
        env.MERCHBASE_ACCESS_API_AUDIENCE
    );
    const interactiveAudience = requireProductionValue(
        'MERCHBASE_ACCESS_INTERACTIVE_AUDIENCE',
        env.MERCHBASE_ACCESS_INTERACTIVE_AUDIENCE
    );
    const authorityClientId = requireProductionValue(
        'MERCHBASE_ACCESS_AUTHORITY_CLIENT_ID',
        env.MERCHBASE_ACCESS_AUTHORITY_CLIENT_ID
    );
    const internalAudience = requireProductionValue(
        'MERCHBASE_ACCESS_ETYSENTRY_INTERNAL_AUDIENCE',
        env.MERCHBASE_ACCESS_ETYSENTRY_INTERNAL_AUDIENCE
    );
    const serviceClientId = requireProductionValue(
        'MERCHBASE_ACCESS_ETYSENTRY_CLIENT_ID',
        env.MERCHBASE_ACCESS_ETYSENTRY_CLIENT_ID
    );
    const serviceClientSecret = requireProductionValue(
        'MERCHBASE_ACCESS_ETYSENTRY_CLIENT_SECRET',
        env.MERCHBASE_ACCESS_ETYSENTRY_CLIENT_SECRET
    );
    const projections = createAccessProjectionStore(database, authorityOrigin);
    const loadSnapshot = createAccessSnapshotClient({
        authorityOrigin,
        clientId: serviceClientId,
        clientSecret: serviceClientSecret,
        issuer,
        service: ETSYSENTRY_SERVICE,
    });
    const resolveServicePrincipal = principalForUser;
    const common = {
        authorityOrigin,
        issuer,
        loadSnapshot,
        projections,
        resolveServicePrincipal,
        service: ETSYSENTRY_SERVICE,
    } as const;

    const interactiveAccess = adapt(
        createCloudflareServiceAccess({
            ...common,
            acceptedPrincipalKinds: ['person'],
            verifier: createCloudflareAssertionVerifier({
                audience: interactiveAudience,
                issuer,
            }),
        }),
        'session'
    );
    const apiAccess = adapt(
        createEtsySentryApiCloudflareAccess({
            ...common,
            audience: apiAudience,
        }),
        'oauth'
    );

    const authorizeRequest = createEtsySentryRequestAuthorizer({
        apiAccess,
        appOrigin: env.ETSYSENTRY_APP_ORIGIN,
        interactiveAccess,
    });

    const internalVerifier = createCloudflareAssertionVerifier({
        audience: internalAudience,
        issuer,
        maxLifetimeSeconds: 600,
    });
    const createProjectionHandler: EtsySentryAccess['createProjectionHandler'] = (onChanged) =>
        createCloudflareProjectionHandler({
            authorityClientId,
            authorityOrigin,
            issuer,
            onChanged,
            projections,
            service: ETSYSENTRY_SERVICE,
            verifier: internalVerifier,
        });

    return {
        apiAccess,
        authorizeRequest,
        createProjectionHandler,
        interactiveAccess,
        projections,
    };
};

let configuredAccess: EtsySentryAccess | null = null;

export const configureEtsySentryAccess = (access: EtsySentryAccess): EtsySentryAccess => {
    configuredAccess = access;
    return access;
};

export const getEtsySentryAccess = (): EtsySentryAccess => {
    if (!configuredAccess) {
        throw new Error('EtsySentry access has not been configured.');
    }
    return configuredAccess;
};

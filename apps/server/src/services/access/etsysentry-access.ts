import {
    type ClerkAuthenticatorOptions,
    createClerkAuthenticator,
    createServiceAccess,
} from '@merchbaseco/access';
import { env } from '../../config/env';
import { db } from '../../db';
import { createAccessProjectionStore } from './access-projection-store';
import { resolveEtsySentryAccountPrincipal } from './account-principal';
import { authorizeEtsySentryCredential } from './authorize-credential';

export const ETSYSENTRY_SERVICE = 'etsysentry' as const;

export const createEtsySentryAccess = (database: typeof db = db) => {
    const authenticatorOptions: ClerkAuthenticatorOptions = {
        authorizedParties: env.clerkAuthorizedParties,
        issuer: env.MERCHBASE_CLERK_ISSUER,
        jwtKey: env.MERCHBASE_CLERK_JWT_KEY,
        publishableKey: env.MERCHBASE_CLERK_PUBLISHABLE_KEY,
        secretKey: env.MERCHBASE_CLERK_SECRET_KEY,
    };
    const authenticator = createClerkAuthenticator(authenticatorOptions);
    const projections = createAccessProjectionStore(database);
    const resolveServicePrincipal = (input: { merchbaseUserId: string }) =>
        resolveEtsySentryAccountPrincipal({
            database,
            merchbaseUserId: input.merchbaseUserId,
        });
    const common = {
        authenticator,
        projections,
        resolveServicePrincipal,
        service: ETSYSENTRY_SERVICE,
    } as const;

    const access = {
        apiKeyAccess: createServiceAccess({
            ...common,
            acceptedCredentialKinds: ['api_key'],
        }),
        authenticator,
        projections,
        oauthAccess: createServiceAccess({
            ...common,
            acceptedCredentialKinds: ['oauth'],
        }),
        sessionAccess: createServiceAccess({
            ...common,
            acceptedCredentialKinds: ['session'],
        }),
    };

    return {
        ...access,
        authorize: (credential: string) => authorizeEtsySentryCredential(access, credential),
    };
};

export type EtsySentryAccess = ReturnType<typeof createEtsySentryAccess>;

let configuredAccess: EtsySentryAccess | null = null;

export const configureEtsySentryAccess = (access: EtsySentryAccess): EtsySentryAccess => {
    configuredAccess = access;
    return access;
};

export const getEtsySentryAccess = (): EtsySentryAccess => {
    return configuredAccess ?? configureEtsySentryAccess(createEtsySentryAccess());
};

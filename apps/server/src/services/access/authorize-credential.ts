import { ServiceAccessError } from '@merchbaseco/access';

interface CredentialAccess<TResult> {
    apiKeyAccess: {
        authorize: (credential: string) => Promise<TResult>;
    };
    oauthAccess: {
        authorize: (credential: string) => Promise<TResult>;
    };
    sessionAccess: {
        authorize: (credential: string) => Promise<TResult>;
    };
}

export const authorizeEtsySentryCredential = async <TResult>(
    access: CredentialAccess<TResult>,
    credential: string
): Promise<TResult> => {
    if (credential.startsWith('ak_')) {
        return access.apiKeyAccess.authorize(credential);
    }

    if (credential.startsWith('oat_')) {
        return access.oauthAccess.authorize(credential);
    }

    if (isJwtLike(credential)) {
        try {
            return await access.sessionAccess.authorize(credential);
        } catch (error) {
            if (error instanceof ServiceAccessError && error.code === 'unauthenticated') {
                return access.oauthAccess.authorize(credential);
            }

            throw error;
        }
    }

    throw new ServiceAccessError('unauthenticated');
};

const isJwtLike = (credential: string): boolean => {
    const segments = credential.split('.');
    return segments.length === 3 && segments.every((segment) => segment.length > 0);
};

import { trpcMutation, trpcQuery } from './trpc-http';

export type EtsyAuthStatus = {
    connected: boolean;
    expiresAt: string | null;
    needsRefresh: boolean;
    scopes: string[];
};

export type EtsyAuthStartResponse = {
    authorizationUrl: string;
    expiresAt: string;
    oauthSessionId: string;
};

export const startEtsyAuth = async (): Promise<EtsyAuthStartResponse> => {
    return trpcMutation<Record<string, never>, EtsyAuthStartResponse>('app.etsyAuth.start', {});
};

export const getEtsyAuthStatus = async (params: {
    oauthSessionId: string;
}): Promise<EtsyAuthStatus> => {
    return trpcQuery<typeof params, EtsyAuthStatus>('app.etsyAuth.status', params);
};

export const refreshEtsyAuth = async (params: {
    oauthSessionId: string;
}): Promise<EtsyAuthStatus> => {
    return trpcMutation<typeof params, EtsyAuthStatus>('app.etsyAuth.refresh', params);
};

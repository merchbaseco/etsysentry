import { queryClient, trpc } from './trpc-client';
import { toTrpcRequestError } from './trpc-http';

export type EtsyAuthStatus = {
    connected: boolean;
    expiresAt: string | null;
    needsRefresh: boolean;
    scopes: string[];
};

export type EtsyAuthStartResponse = {
    authorizationUrl: string;
    expiresAt: string;
};

const executeMutation = async <TInput, TOutput>(
    input: TInput,
    options: {
        mutationFn?: (nextInput: TInput) => Promise<TOutput>;
    }
): Promise<TOutput> => {
    if (!options.mutationFn) {
        throw new Error('tRPC mutation function was not configured.');
    }

    return options.mutationFn(input);
};

export const startEtsyAuth = async (): Promise<EtsyAuthStartResponse> => {
    try {
        const response = await executeMutation<Record<string, never>, EtsyAuthStartResponse>(
            {},
            trpc.app.etsyAuth.start.mutationOptions()
        );

        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const getEtsyAuthStatus = async (): Promise<EtsyAuthStatus> => {
    try {
        const response = await queryClient.fetchQuery(trpc.app.etsyAuth.status.queryOptions({}));
        return response as EtsyAuthStatus;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const refreshEtsyAuth = async (): Promise<EtsyAuthStatus> => {
    try {
        const response = await executeMutation<Record<string, never>, EtsyAuthStatus>(
            {},
            trpc.app.etsyAuth.refresh.mutationOptions()
        );

        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const disconnectEtsyAuth = async (): Promise<EtsyAuthStatus> => {
    try {
        const response = await executeMutation<Record<string, never>, EtsyAuthStatus>(
            {},
            trpc.app.etsyAuth.disconnect.mutationOptions()
        );

        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

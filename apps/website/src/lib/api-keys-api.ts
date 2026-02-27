import { trpcClient } from './trpc-client';
import { toTrpcRequestError } from './trpc-http';
import type { InferProcedureInput, InferProcedureOutput } from './trpc-inference';

export type ListApiKeysOutput = InferProcedureOutput<typeof trpcClient.app.apiKeys.list.query>;

export type ApiKeyRecord = ListApiKeysOutput['items'][number];

export type CreateApiKeyInput = InferProcedureInput<typeof trpcClient.app.apiKeys.create.mutate>;

export type CreateApiKeyOutput = InferProcedureOutput<typeof trpcClient.app.apiKeys.create.mutate>;

export type RevokeApiKeyInput = InferProcedureInput<typeof trpcClient.app.apiKeys.revoke.mutate>;

export type RevokeApiKeyOutput = InferProcedureOutput<typeof trpcClient.app.apiKeys.revoke.mutate>;

export const listApiKeys = async (): Promise<ListApiKeysOutput> => {
    try {
        return await trpcClient.app.apiKeys.list.query({});
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const createApiKey = async (input: CreateApiKeyInput): Promise<CreateApiKeyOutput> => {
    try {
        return await trpcClient.app.apiKeys.create.mutate(input);
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const revokeApiKey = async (input: RevokeApiKeyInput): Promise<RevokeApiKeyOutput> => {
    try {
        return await trpcClient.app.apiKeys.revoke.mutate(input);
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

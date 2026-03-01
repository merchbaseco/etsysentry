import type { trpcClient } from './trpc-client';
import type { InferProcedureInput, InferProcedureOutput } from './trpc-inference';

export type ListApiKeysOutput = InferProcedureOutput<typeof trpcClient.app.apiKeys.list.query>;

export type ApiKeyRecord = ListApiKeysOutput['items'][number];

export type CreateApiKeyInput = InferProcedureInput<typeof trpcClient.app.apiKeys.create.mutate>;

export type CreateApiKeyOutput = InferProcedureOutput<typeof trpcClient.app.apiKeys.create.mutate>;

export type RevokeApiKeyInput = InferProcedureInput<typeof trpcClient.app.apiKeys.revoke.mutate>;

export type RevokeApiKeyOutput = InferProcedureOutput<typeof trpcClient.app.apiKeys.revoke.mutate>;

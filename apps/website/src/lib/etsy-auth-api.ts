import type { trpcClient } from './trpc-client';
import type { InferProcedureOutput } from './trpc-inference';

export type EtsyAuthStatus = InferProcedureOutput<typeof trpcClient.app.etsyAuth.status.query>;

export type EtsyAuthStartResponse = InferProcedureOutput<
    typeof trpcClient.app.etsyAuth.start.mutate
>;

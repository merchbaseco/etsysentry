import type { trpcClient } from './trpc-client';
import type { InferProcedureOutput } from './trpc-inference';

export type CurrencyStatus = InferProcedureOutput<typeof trpcClient.app.currency.getStatus.query>;

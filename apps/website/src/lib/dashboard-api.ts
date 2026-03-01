import type { trpcClient } from './trpc-client';
import type { InferProcedureOutput } from './trpc-inference';

export type DashboardSummary = InferProcedureOutput<
    typeof trpcClient.app.dashboard.getSummary.query
>;

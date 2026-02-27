import { queryClient, trpc, type trpcClient } from './trpc-client';
import { toTrpcRequestError } from './trpc-http';
import type { InferProcedureInput, InferProcedureOutput } from './trpc-inference';

export type ListEventLogsInput = InferProcedureInput<typeof trpcClient.app.logs.list.query>;
export type ListEventLogsOutput = InferProcedureOutput<typeof trpcClient.app.logs.list.query>;
export type EventLogItem = ListEventLogsOutput['items'][number];
export type EventLogLevel = EventLogItem['level'];
export type EventLogStatus = EventLogItem['status'];
export type EventLogPrimitiveType = EventLogItem['primitiveType'];
export type EventLogCursor = ListEventLogsOutput['nextCursor'];

export const listEventLogs = async (params: ListEventLogsInput): Promise<ListEventLogsOutput> => {
    try {
        const response = await queryClient.fetchQuery(trpc.app.logs.list.queryOptions(params));
        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

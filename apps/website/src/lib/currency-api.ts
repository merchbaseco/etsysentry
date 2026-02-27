import { queryClient, trpc, trpcClient } from './trpc-client';
import { toTrpcRequestError } from './trpc-http';
import type { InferProcedureOutput } from './trpc-inference';

export type CurrencyStatus = InferProcedureOutput<typeof trpcClient.app.currency.getStatus.query>;

export const getCurrencyStatus = async (): Promise<CurrencyStatus> => {
    try {
        return await queryClient.fetchQuery(trpc.app.currency.getStatus.queryOptions({}));
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

export const refreshCurrencyRates = async (): Promise<CurrencyStatus> => {
    try {
        const response = await trpcClient.app.currency.refresh.mutate({});
        queryClient.setQueryData(trpc.app.currency.getStatus.queryOptions({}).queryKey, response);
        await queryClient.invalidateQueries({
            queryKey: trpc.app.listings.list.queryOptions({}).queryKey,
        });
        return response;
    } catch (error) {
        throw toTrpcRequestError(error);
    }
};

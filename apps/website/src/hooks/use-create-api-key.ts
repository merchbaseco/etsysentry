import { useMutation } from '@tanstack/react-query';
import type { CreateApiKeyInput } from '@/lib/api-keys-api';
import { trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

export const useCreateApiKey = () => {
    return useMutation({
        mutationFn: async (input: CreateApiKeyInput) => {
            try {
                return await trpcClient.app.apiKeys.create.mutate(input);
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
    });
};

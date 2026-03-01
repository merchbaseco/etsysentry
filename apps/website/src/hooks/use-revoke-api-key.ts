import { useMutation } from '@tanstack/react-query';
import type { RevokeApiKeyInput } from '@/lib/api-keys-api';
import { trpcClient } from '@/lib/trpc-client';
import { toTrpcRequestError } from '@/lib/trpc-http';

export const useRevokeApiKey = () => {
    return useMutation({
        mutationFn: async (input: RevokeApiKeyInput) => {
            try {
                return await trpcClient.app.apiKeys.revoke.mutate(input);
            } catch (error) {
                throw toTrpcRequestError(error);
            }
        },
    });
};

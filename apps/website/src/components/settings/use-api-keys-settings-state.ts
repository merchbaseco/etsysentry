import { useCallback, useEffect, useState } from 'react';
import { useApiKeys } from '@/hooks/use-api-keys';
import { useCreateApiKey } from '@/hooks/use-create-api-key';
import { useRevokeApiKey } from '@/hooks/use-revoke-api-key';
import type { ApiKeyRecord } from '@/lib/api-keys-api';
import { pickNewestActiveApiKey } from './api-key-utils';
import { formatApiKeyErrorMessage, type SettingsPage } from './shared';

interface UseApiKeysSettingsStateParams {
    activePage: SettingsPage;
    open: boolean;
}

export interface UseApiKeysSettingsStateOutput {
    activeApiKey: ApiKeyRecord | null;
    apiKeyErrorMessage: string | null;
    isLoadingApiKey: boolean;
    isRotatingApiKey: boolean;
    loadApiKey: () => Promise<void>;
    rawApiKey: string | null;
    rotateApiKey: () => Promise<void>;
}

const API_KEYS_PAGE: SettingsPage = 'api-keys';

export const useApiKeysSettingsState = ({
    activePage,
    open,
}: UseApiKeysSettingsStateParams): UseApiKeysSettingsStateOutput => {
    const apiKeysQuery = useApiKeys({
        enabled: false,
    });
    const createApiKeyMutation = useCreateApiKey();
    const revokeApiKeyMutation = useRevokeApiKey();
    const refetchApiKeys = apiKeysQuery.refetch;
    const createApiKey = createApiKeyMutation.mutateAsync;
    const revokeApiKey = revokeApiKeyMutation.mutateAsync;
    const [activeApiKey, setActiveApiKey] = useState<ApiKeyRecord | null>(null);
    const [apiKeyErrorMessage, setApiKeyErrorMessage] = useState<string | null>(null);
    const [rawApiKey, setRawApiKey] = useState<string | null>(null);
    const isLoadingApiKey = apiKeysQuery.isFetching;
    const isRotatingApiKey = createApiKeyMutation.isPending || revokeApiKeyMutation.isPending;

    const loadApiKey = useCallback(async () => {
        try {
            const result = await refetchApiKeys();
            const response = result.data;

            if (!response) {
                throw result.error ?? new Error('Failed to fetch API keys.');
            }

            const nextActiveApiKey = pickNewestActiveApiKey(response.items);

            setActiveApiKey(nextActiveApiKey);
            setRawApiKey((currentRawApiKey) => {
                if (!(nextActiveApiKey && currentRawApiKey)) {
                    return null;
                }

                return currentRawApiKey.startsWith(nextActiveApiKey.keyPrefix)
                    ? currentRawApiKey
                    : null;
            });
            setApiKeyErrorMessage(null);
        } catch (error) {
            setApiKeyErrorMessage(formatApiKeyErrorMessage(error));
        }
    }, [refetchApiKeys]);

    const rotateApiKey = useCallback(async () => {
        if (isRotatingApiKey) {
            return;
        }

        try {
            const currentActiveApiKey = activeApiKey;

            if (currentActiveApiKey) {
                await revokeApiKey({
                    apiKeyId: currentActiveApiKey.id,
                });
            }

            const createdApiKey = await createApiKey({
                name: currentActiveApiKey?.name,
            });

            setActiveApiKey(createdApiKey.item);
            setRawApiKey(createdApiKey.rawApiKey);
            setApiKeyErrorMessage(null);
        } catch (error) {
            setApiKeyErrorMessage(formatApiKeyErrorMessage(error));
            await loadApiKey();
        }
    }, [activeApiKey, createApiKey, isRotatingApiKey, loadApiKey, revokeApiKey]);

    useEffect(() => {
        if (!open || activePage !== API_KEYS_PAGE) {
            return;
        }

        loadApiKey();
    }, [activePage, loadApiKey, open]);

    useEffect(() => {
        if (open) {
            return;
        }

        setActiveApiKey(null);
        setApiKeyErrorMessage(null);
        setRawApiKey(null);
    }, [open]);

    return {
        activeApiKey,
        apiKeyErrorMessage,
        isLoadingApiKey,
        isRotatingApiKey,
        loadApiKey,
        rawApiKey,
        rotateApiKey,
    };
};

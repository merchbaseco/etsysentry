import { useCallback, useEffect, useState } from 'react';
import { type ApiKeyRecord, createApiKey, listApiKeys, revokeApiKey } from '@/lib/api-keys-api';
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
    const [activeApiKey, setActiveApiKey] = useState<ApiKeyRecord | null>(null);
    const [isLoadingApiKey, setIsLoadingApiKey] = useState(false);
    const [isRotatingApiKey, setIsRotatingApiKey] = useState(false);
    const [apiKeyErrorMessage, setApiKeyErrorMessage] = useState<string | null>(null);
    const [rawApiKey, setRawApiKey] = useState<string | null>(null);

    const loadApiKey = useCallback(async () => {
        setIsLoadingApiKey(true);

        try {
            const response = await listApiKeys();
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
        } finally {
            setIsLoadingApiKey(false);
        }
    }, []);

    const rotateApiKey = useCallback(async () => {
        if (isRotatingApiKey) {
            return;
        }

        setIsRotatingApiKey(true);

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
        } finally {
            setIsRotatingApiKey(false);
        }
    }, [activeApiKey, isRotatingApiKey, loadApiKey]);

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

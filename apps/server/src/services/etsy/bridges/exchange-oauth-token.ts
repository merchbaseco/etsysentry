import { env } from '../../../config/env';
import { z } from 'zod';
import { fetchEtsyApi } from '../fetch-etsy-api';
import { getEtsyApiKeyHeaderValue } from '../get-etsy-api-key-header-value';

const etsyOAuthSuccessResponseSchema = z.object({
    access_token: z.string().min(1),
    expires_in: z.coerce.number().int().positive(),
    refresh_token: z.string().min(1),
    scope: z.string().optional(),
    token_type: z.string().min(1)
});

const etsyOAuthErrorResponseSchema = z
    .object({
        error: z.string().optional(),
        error_description: z.string().optional()
    })
    .passthrough();

export type EtsyOAuthTokenRequest =
    | {
          code: string;
          codeVerifier: string;
          grantType: 'authorization_code';
          redirectUri: string;
      }
    | {
          grantType: 'refresh_token';
          refreshToken: string;
      };

export type EtsyOAuthTokenResponse = {
    accessToken: string;
    expiresInSeconds: number;
    refreshToken: string;
    scopes: string[];
    tokenType: string;
};

export class EtsyOAuthBridgeError extends Error {
    readonly responseBody: string;
    readonly statusCode: number;

    constructor(message: string, statusCode: number, responseBody: string) {
        super(message);
        this.name = 'EtsyOAuthBridgeError';
        this.statusCode = statusCode;
        this.responseBody = responseBody;
    }
}

const buildRequestBody = (input: EtsyOAuthTokenRequest): URLSearchParams => {
    if (input.grantType === 'authorization_code') {
        return new URLSearchParams({
            client_id: env.ETSY_API_KEY,
            code: input.code,
            code_verifier: input.codeVerifier,
            grant_type: input.grantType,
            redirect_uri: input.redirectUri
        });
    }

    return new URLSearchParams({
        client_id: env.ETSY_API_KEY,
        grant_type: input.grantType,
        refresh_token: input.refreshToken
    });
};

const parseScopes = (scopeValue: string | undefined): string[] => {
    if (!scopeValue) {
        return [];
    }

    return scopeValue
        .split(/[\s,]+/)
        .map((scope) => scope.trim())
        .filter((scope) => scope.length > 0);
};

const truncateForLog = (input: string): string => {
    if (input.length <= 512) {
        return input;
    }

    return `${input.slice(0, 512)}...`;
};

const logOAuthBridgeDebug = (message: string, details: Record<string, unknown>): void => {
    console.info(`[EtsyOAuthBridge] ${message}`, details);
};

const tryParseJson = (input: string): unknown | null => {
    if (input.length === 0) {
        return null;
    }

    try {
        return JSON.parse(input);
    } catch {
        return null;
    }
};

export const exchangeOAuthToken = async (
    input: EtsyOAuthTokenRequest
): Promise<EtsyOAuthTokenResponse> => {
    logOAuthBridgeDebug('starting token exchange', {
        grantType: input.grantType
    });

    const response = await fetchEtsyApi({
        init: {
            body: buildRequestBody(input),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'x-api-key': getEtsyApiKeyHeaderValue()
            },
            method: 'POST'
        },
        url: 'https://api.etsy.com/v3/public/oauth/token'
    });

    const rawBody = await response.text();

    if (!response.ok) {
        const parsedError = etsyOAuthErrorResponseSchema.safeParse(tryParseJson(rawBody) ?? {});

        const errorMessage = parsedError.success
            ? parsedError.data.error_description ??
              parsedError.data.error ??
              `Etsy OAuth token exchange failed with HTTP ${response.status}.`
            : `Etsy OAuth token exchange failed with HTTP ${response.status}.`;

        logOAuthBridgeDebug('token exchange failed', {
            grantType: input.grantType,
            rawBodyPreview: truncateForLog(rawBody),
            statusCode: response.status
        });

        throw new EtsyOAuthBridgeError(errorMessage, response.status, rawBody);
    }

    const jsonBody = tryParseJson(rawBody) ?? {};
    const parsed = etsyOAuthSuccessResponseSchema.safeParse(jsonBody);

    if (!parsed.success) {
        logOAuthBridgeDebug('token exchange response shape was invalid', {
            grantType: input.grantType,
            rawBodyPreview: truncateForLog(rawBody),
            statusCode: response.status
        });

        throw new EtsyOAuthBridgeError(
            'Etsy OAuth token response was missing required fields.',
            response.status,
            rawBody
        );
    }

    const parsedScopes = parseScopes(parsed.data.scope);

    logOAuthBridgeDebug('token exchange succeeded', {
        grantType: input.grantType,
        hasScopeField: parsed.data.scope !== undefined,
        rawScope: parsed.data.scope ?? null,
        scopeCount: parsedScopes.length,
        scopes: parsedScopes,
        statusCode: response.status
    });

    return {
        accessToken: parsed.data.access_token,
        expiresInSeconds: parsed.data.expires_in,
        refreshToken: parsed.data.refresh_token,
        scopes: parsedScopes,
        tokenType: parsed.data.token_type
    };
};

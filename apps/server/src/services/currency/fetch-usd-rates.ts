import { z } from 'zod';

const successResponseSchema = z.object({
    base_code: z.literal('USD'),
    rates: z.record(z.string(), z.coerce.number().positive()),
    result: z.literal('success'),
    time_last_update_unix: z.coerce.number().int().positive(),
    time_next_update_unix: z.coerce.number().int().positive(),
});

const errorResponseSchema = z.object({
    'error-type': z.string().min(1).optional(),
    result: z.string().min(1).optional(),
});

const providerEndpoint = 'https://open.er-api.com/v6/latest/USD';
const providerName = 'open.er-api.com';

const tryParseJson = (value: string): unknown | null => {
    if (value.length === 0) {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

export class FetchUsdRatesError extends Error {
    readonly responseBody: string;
    readonly statusCode: number;

    constructor(message: string, statusCode: number, responseBody: string) {
        super(message);
        this.name = 'FetchUsdRatesError';
        this.responseBody = responseBody;
        this.statusCode = statusCode;
    }
}

export interface FetchUsdRatesResult {
    fetchedAt: Date;
    nextProviderUpdateAt: Date;
    provider: string;
    rates: Record<string, number>;
}

const toErrorMessage = (rawBody: string, statusCode: number): string => {
    const parsedBody = tryParseJson(rawBody);
    const parsedError = errorResponseSchema.safeParse(parsedBody ?? {});

    if (parsedError.success) {
        return (
            parsedError.data['error-type'] ??
            parsedError.data.result ??
            `FX provider request failed with HTTP ${statusCode}.`
        );
    }

    return `FX provider request failed with HTTP ${statusCode}.`;
};

export const fetchUsdRates = async (): Promise<FetchUsdRatesResult> => {
    const response = await fetch(providerEndpoint, {
        headers: {
            Accept: 'application/json',
        },
        method: 'GET',
    });

    const rawBody = await response.text();

    if (!response.ok) {
        throw new FetchUsdRatesError(
            toErrorMessage(rawBody, response.status),
            response.status,
            rawBody
        );
    }

    const parsedBody = successResponseSchema.safeParse(tryParseJson(rawBody) ?? {});

    if (!parsedBody.success) {
        throw new FetchUsdRatesError(
            'FX provider response was missing required fields.',
            200,
            rawBody
        );
    }

    return {
        fetchedAt: new Date(parsedBody.data.time_last_update_unix * 1000),
        nextProviderUpdateAt: new Date(parsedBody.data.time_next_update_unix * 1000),
        provider: providerName,
        rates: parsedBody.data.rates,
    };
};

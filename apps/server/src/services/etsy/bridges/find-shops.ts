import { z } from 'zod';
import { fetchEtsyApi } from '../fetch-etsy-api';
import { getEtsyApiKeyHeaderValue } from '../get-etsy-api-key-header-value';

const inputSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).optional(),
    shopName: z.string().trim().min(1),
});

const shopResultSchema = z
    .object({
        shop_id: z.coerce.number().int().positive(),
        shop_name: z.string().min(1),
        url: z.string().nullable().optional(),
    })
    .passthrough();

const responseSchema = z
    .object({
        count: z.coerce.number().int().nonnegative(),
        results: z.array(shopResultSchema),
    })
    .passthrough();

const etsyErrorSchema = z
    .object({
        error: z.string().optional(),
        error_description: z.string().optional(),
        message: z.string().optional(),
    })
    .passthrough();

export type FindShopsBridgeInput = z.input<typeof inputSchema>;

export interface FindShopsBridgeResponse {
    count: number;
    results: Array<{
        shopId: string;
        shopName: string;
        url: string | null;
    }>;
}

export class EtsyFindShopsBridgeError extends Error {
    readonly responseBody: string;
    readonly statusCode: number;

    constructor(message: string, statusCode: number, responseBody: string) {
        super(message);
        this.name = 'EtsyFindShopsBridgeError';
        this.statusCode = statusCode;
        this.responseBody = responseBody;
    }
}

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

const extractErrorMessage = (rawBody: string, statusCode: number): string => {
    const parsedBody = tryParseJson(rawBody);
    const parsedError = etsyErrorSchema.safeParse(parsedBody ?? {});

    if (parsedError.success) {
        return (
            parsedError.data.error_description ??
            parsedError.data.message ??
            parsedError.data.error ??
            `Etsy findShops failed with HTTP ${statusCode}.`
        );
    }

    return `Etsy findShops failed with HTTP ${statusCode}.`;
};

const buildEndpoint = (input: z.infer<typeof inputSchema>): string => {
    const url = new URL('https://openapi.etsy.com/v3/application/shops');

    url.searchParams.set('shop_name', input.shopName);

    if (input.limit !== undefined) {
        url.searchParams.set('limit', String(input.limit));
    }

    if (input.offset !== undefined) {
        url.searchParams.set('offset', String(input.offset));
    }

    return url.toString();
};

const toResponse = (parsed: z.infer<typeof responseSchema>): FindShopsBridgeResponse => {
    return {
        count: parsed.count,
        results: parsed.results.map((item) => ({
            shopId: String(item.shop_id),
            shopName: item.shop_name,
            url: item.url ?? null,
        })),
    };
};

export const findShops = async (input: FindShopsBridgeInput): Promise<FindShopsBridgeResponse> => {
    const parsedInput = inputSchema.safeParse(input);

    if (!parsedInput.success) {
        throw new EtsyFindShopsBridgeError('Invalid findShops bridge input.', 400, '');
    }

    const response = await fetchEtsyApi({
        init: {
            headers: {
                Accept: 'application/json',
                'x-api-key': getEtsyApiKeyHeaderValue(),
            },
            method: 'GET',
        },
        url: buildEndpoint(parsedInput.data),
    });

    const rawBody = await response.text();

    if (!response.ok) {
        throw new EtsyFindShopsBridgeError(
            extractErrorMessage(rawBody, response.status),
            response.status,
            rawBody
        );
    }

    const parsedJson = tryParseJson(rawBody) ?? {};
    const parsedBody = responseSchema.safeParse(parsedJson);

    if (!parsedBody.success) {
        throw new EtsyFindShopsBridgeError(
            'Etsy findShops response was missing required fields.',
            response.status,
            rawBody
        );
    }

    return toResponse(parsedBody.data);
};

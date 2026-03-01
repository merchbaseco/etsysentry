import { z } from 'zod';
import { fetchEtsyApi } from '../fetch-etsy-api';
import { getEtsyApiKeyHeaderValue } from '../get-etsy-api-key-header-value';

const inputSchema = z.object({
    shopId: z.string().regex(/^\d+$/),
});

const responseSchema = z
    .object({
        city: z.string().nullable().optional(),
        country_name: z.string().nullable().optional(),
        create_date: z.coerce.number().int().nonnegative().nullable().optional(),
        create_timestamp: z.coerce.number().int().nonnegative().nullable().optional(),
        icon_url_fullxfull: z.string().nullable().optional(),
        listing_active_count: z.coerce.number().int().nonnegative().nullable().optional(),
        num_favorers: z.coerce.number().int().nonnegative().nullable().optional(),
        region: z.string().nullable().optional(),
        review_average: z.coerce.number().nonnegative().nullable().optional(),
        review_count: z.coerce.number().int().nonnegative().nullable().optional(),
        shop_id: z.coerce.number().int().positive(),
        shop_name: z.string().min(1),
        transaction_sold_count: z.coerce.number().int().nonnegative().nullable().optional(),
        updated_timestamp: z.coerce.number().int().nonnegative().nullable().optional(),
        url: z.string().nullable().optional(),
    })
    .passthrough();

const etsyErrorSchema = z
    .object({
        error: z.string().optional(),
        error_description: z.string().optional(),
        message: z.string().optional(),
    })
    .passthrough();

export type GetShopBridgeInput = z.input<typeof inputSchema>;

export interface GetShopBridgeResponse {
    activeListingCount: number | null;
    avatarUrl: string | null;
    city: string | null;
    countryName: string | null;
    createdTimestamp: number | null;
    numFavorers: number | null;
    region: string | null;
    reviewAverage: number | null;
    reviewCount: number | null;
    shopId: string;
    shopName: string;
    soldCount: number | null;
    updatedTimestamp: number | null;
    url: string | null;
}

export class EtsyGetShopBridgeError extends Error {
    readonly responseBody: string;
    readonly statusCode: number;

    constructor(message: string, statusCode: number, responseBody: string) {
        super(message);
        this.name = 'EtsyGetShopBridgeError';
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
            `Etsy getShop failed with HTTP ${statusCode}.`
        );
    }

    return `Etsy getShop failed with HTTP ${statusCode}.`;
};

const buildEndpoint = (input: z.infer<typeof inputSchema>): string => {
    return `https://openapi.etsy.com/v3/application/shops/${input.shopId}`;
};

const toResponse = (parsed: z.infer<typeof responseSchema>): GetShopBridgeResponse => {
    const createdTimestamp = parsed.create_timestamp ?? parsed.create_date ?? null;

    return {
        activeListingCount: parsed.listing_active_count ?? null,
        avatarUrl: parsed.icon_url_fullxfull ?? null,
        city: parsed.city ?? null,
        countryName: parsed.country_name ?? null,
        createdTimestamp,
        numFavorers: parsed.num_favorers ?? null,
        region: parsed.region ?? null,
        reviewAverage: parsed.review_average ?? null,
        reviewCount: parsed.review_count ?? null,
        shopId: String(parsed.shop_id),
        shopName: parsed.shop_name,
        soldCount: parsed.transaction_sold_count ?? null,
        updatedTimestamp: parsed.updated_timestamp ?? null,
        url: parsed.url ?? null,
    };
};

export const getShop = async (input: GetShopBridgeInput): Promise<GetShopBridgeResponse> => {
    const parsedInput = inputSchema.safeParse(input);

    if (!parsedInput.success) {
        throw new EtsyGetShopBridgeError('Invalid getShop bridge input.', 400, '');
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
        throw new EtsyGetShopBridgeError(
            extractErrorMessage(rawBody, response.status),
            response.status,
            rawBody
        );
    }

    const parsedJson = tryParseJson(rawBody) ?? {};
    const parsedBody = responseSchema.safeParse(parsedJson);

    if (!parsedBody.success) {
        throw new EtsyGetShopBridgeError(
            'Etsy getShop response was missing required fields.',
            response.status,
            rawBody
        );
    }

    return toResponse(parsedBody.data);
};

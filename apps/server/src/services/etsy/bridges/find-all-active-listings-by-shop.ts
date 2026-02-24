import { z } from 'zod';
import { fetchEtsyApi } from '../fetch-etsy-api';
import { getEtsyApiKeyHeaderValue } from '../get-etsy-api-key-header-value';

const sortOnSchema = z.enum(['created', 'price', 'updated', 'score']);

const sortOrderSchema = z.enum(['asc', 'ascending', 'desc', 'descending', 'up', 'down']);

const listingStateSchema = z.enum(['active', 'inactive', 'sold_out', 'draft', 'expired']);
const listingTypeSchema = z.enum(['physical', 'download', 'both']);

const moneySchema = z.object({
    amount: z.coerce.number().int(),
    currency_code: z.string().min(1),
    divisor: z.coerce.number().int().positive()
});

const listingSchema = z
    .object({
        listing_id: z.coerce.number().int().positive(),
        listing_type: listingTypeSchema.nullable().optional(),
        num_favorers: z.coerce.number().int().nonnegative().nullable().optional(),
        price: moneySchema.nullable().optional(),
        quantity: z.coerce.number().int().nonnegative().nullable().optional(),
        shop_id: z.coerce.number().int().positive().nullable().optional(),
        state: listingStateSchema.nullable().optional(),
        title: z.string().min(1),
        updated_timestamp: z.coerce.number().int().nonnegative().nullable().optional(),
        url: z.string().nullable().optional()
    })
    .passthrough();

const responseSchema = z
    .object({
        count: z.coerce.number().int().nonnegative(),
        results: z.array(listingSchema)
    })
    .passthrough();

const inputSchema = z.object({
    keywords: z.string().min(1).optional(),
    legacy: z.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).optional(),
    shopId: z.string().regex(/^\d+$/),
    sortOn: sortOnSchema.optional(),
    sortOrder: sortOrderSchema.optional()
});

const etsyErrorSchema = z
    .object({
        error: z.string().optional(),
        error_description: z.string().optional(),
        message: z.string().optional()
    })
    .passthrough();

export type EtsyFindAllActiveListingsByShopSortOn = z.infer<typeof sortOnSchema>;
export type EtsyFindAllActiveListingsByShopSortOrder = z.infer<typeof sortOrderSchema>;
export type EtsyFindAllActiveListingsByShopListingType = z.infer<typeof listingTypeSchema>;

export type FindAllActiveListingsByShopBridgeInput = {
    keywords?: string;
    legacy?: boolean;
    limit?: number;
    offset?: number;
    shopId: string;
    sortOn?: EtsyFindAllActiveListingsByShopSortOn;
    sortOrder?: EtsyFindAllActiveListingsByShopSortOrder;
};

export type FindAllActiveListingsByShopBridgeResponse = {
    count: number;
    results: Array<{
        etsyState: z.infer<typeof listingStateSchema> | null;
        listingId: string;
        listingType: EtsyFindAllActiveListingsByShopListingType | null;
        numFavorers: number | null;
        price: {
            amount: number;
            currencyCode: string;
            divisor: number;
        } | null;
        quantity: number | null;
        shopId: string | null;
        title: string;
        updatedTimestamp: number | null;
        url: string | null;
    }>;
};

export class EtsyFindAllActiveListingsByShopBridgeError extends Error {
    readonly responseBody: string;
    readonly statusCode: number;

    constructor(message: string, statusCode: number, responseBody: string) {
        super(message);
        this.name = 'EtsyFindAllActiveListingsByShopBridgeError';
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
            `Etsy findAllActiveListingsByShop failed with HTTP ${statusCode}.`
        );
    }

    return `Etsy findAllActiveListingsByShop failed with HTTP ${statusCode}.`;
};

const buildEndpoint = (input: z.infer<typeof inputSchema>): string => {
    const url = new URL(
        `https://openapi.etsy.com/v3/application/shops/${input.shopId}/listings/active`
    );

    if (input.limit !== undefined) {
        url.searchParams.set('limit', String(input.limit));
    }

    if (input.offset !== undefined) {
        url.searchParams.set('offset', String(input.offset));
    }

    if (input.sortOn) {
        url.searchParams.set('sort_on', input.sortOn);
    }

    if (input.sortOrder) {
        url.searchParams.set('sort_order', input.sortOrder);
    }

    if (input.keywords) {
        url.searchParams.set('keywords', input.keywords);
    }

    if (input.legacy !== undefined) {
        url.searchParams.set('legacy', String(input.legacy));
    }

    return url.toString();
};

const toResponse = (
    parsed: z.infer<typeof responseSchema>
): FindAllActiveListingsByShopBridgeResponse => {
    return {
        count: parsed.count,
        results: parsed.results.map((item) => ({
            etsyState: item.state ?? null,
            listingId: String(item.listing_id),
            listingType: item.listing_type ?? null,
            numFavorers: item.num_favorers ?? null,
            price: item.price
                ? {
                      amount: item.price.amount,
                      currencyCode: item.price.currency_code,
                      divisor: item.price.divisor
                  }
                : null,
            quantity: item.quantity ?? null,
            shopId: item.shop_id === null || item.shop_id === undefined ? null : String(item.shop_id),
            title: item.title,
            updatedTimestamp: item.updated_timestamp ?? null,
            url: item.url ?? null
        }))
    };
};

export const findAllActiveListingsByShop = async (
    input: FindAllActiveListingsByShopBridgeInput
): Promise<FindAllActiveListingsByShopBridgeResponse> => {
    const parsedInput = inputSchema.safeParse(input);

    if (!parsedInput.success) {
        throw new EtsyFindAllActiveListingsByShopBridgeError(
            'Invalid findAllActiveListingsByShop bridge input.',
            400,
            ''
        );
    }

    const response = await fetchEtsyApi({
        init: {
            headers: {
                Accept: 'application/json',
                'x-api-key': getEtsyApiKeyHeaderValue()
            },
            method: 'GET'
        },
        url: buildEndpoint(parsedInput.data)
    });

    const rawBody = await response.text();

    if (!response.ok) {
        throw new EtsyFindAllActiveListingsByShopBridgeError(
            extractErrorMessage(rawBody, response.status),
            response.status,
            rawBody
        );
    }

    const parsedJson = tryParseJson(rawBody) ?? {};
    const parsedBody = responseSchema.safeParse(parsedJson);

    if (!parsedBody.success) {
        throw new EtsyFindAllActiveListingsByShopBridgeError(
            'Etsy findAllActiveListingsByShop response was missing required fields.',
            response.status,
            rawBody
        );
    }

    return toResponse(parsedBody.data);
};

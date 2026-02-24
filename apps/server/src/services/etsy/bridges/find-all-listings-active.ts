import { z } from 'zod';
import { fetchEtsyApi } from '../fetch-etsy-api';
import { getEtsyApiKeyHeaderValue } from '../get-etsy-api-key-header-value';

const sortOnSchema = z.enum(['created', 'price', 'updated', 'score']);

const sortOrderSchema = z.enum(['asc', 'ascending', 'desc', 'descending', 'up', 'down']);

const moneySchema = z.object({
    amount: z.coerce.number().int(),
    currency_code: z.string().min(1),
    divisor: z.coerce.number().int().positive()
});

const listingSchema = z
    .object({
        images: z.array(z.unknown()).nullable().optional(),
        listing_id: z.coerce.number().int().positive(),
        main_image: z.unknown().nullable().optional(),
        price: moneySchema.nullable().optional(),
        shop_id: z.coerce.number().int().positive().nullable().optional(),
        title: z.string().min(1),
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
    accessToken: z.string().min(1),
    keywords: z.string().min(1).optional(),
    legacy: z.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    offset: z.coerce.number().int().min(0).optional(),
    shopLocation: z.string().min(1).optional(),
    sortOn: sortOnSchema.optional(),
    sortOrder: sortOrderSchema.optional(),
    taxonomyId: z.coerce.number().int().positive().optional()
});

const etsyErrorSchema = z
    .object({
        error: z.string().optional(),
        error_description: z.string().optional(),
        message: z.string().optional()
    })
    .passthrough();

export type EtsyFindAllListingsActiveSortOn = z.infer<typeof sortOnSchema>;
export type EtsyFindAllListingsActiveSortOrder = z.infer<typeof sortOrderSchema>;

export type FindAllListingsActiveBridgeInput = {
    accessToken: string;
    keywords?: string;
    legacy?: boolean;
    limit?: number;
    maxPrice?: number;
    minPrice?: number;
    offset?: number;
    shopLocation?: string;
    sortOn?: EtsyFindAllListingsActiveSortOn;
    sortOrder?: EtsyFindAllListingsActiveSortOrder;
    taxonomyId?: number;
};

export type FindAllListingsActiveBridgeResponse = {
    count: number;
    results: Array<{
        listingId: string;
        price: {
            amount: number;
            currencyCode: string;
            divisor: number;
        } | null;
        shopId: string | null;
        thumbnailUrl: string | null;
        title: string;
        url: string | null;
    }>;
};

export class EtsyFindAllListingsActiveBridgeError extends Error {
    readonly responseBody: string;
    readonly statusCode: number;

    constructor(message: string, statusCode: number, responseBody: string) {
        super(message);
        this.name = 'EtsyFindAllListingsActiveBridgeError';
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
            `Etsy findAllListingsActive failed with HTTP ${statusCode}.`
        );
    }

    return `Etsy findAllListingsActive failed with HTTP ${statusCode}.`;
};

const buildEndpoint = (input: z.infer<typeof inputSchema>): string => {
    const url = new URL('https://openapi.etsy.com/v3/application/listings/active');

    if (input.limit !== undefined) {
        url.searchParams.set('limit', String(input.limit));
    }

    if (input.offset !== undefined) {
        url.searchParams.set('offset', String(input.offset));
    }

    if (input.keywords) {
        url.searchParams.set('keywords', input.keywords);
    }

    if (input.sortOn) {
        url.searchParams.set('sort_on', input.sortOn);
    }

    if (input.sortOrder) {
        url.searchParams.set('sort_order', input.sortOrder);
    }

    if (input.minPrice !== undefined) {
        url.searchParams.set('min_price', String(input.minPrice));
    }

    if (input.maxPrice !== undefined) {
        url.searchParams.set('max_price', String(input.maxPrice));
    }

    if (input.taxonomyId !== undefined) {
        url.searchParams.set('taxonomy_id', String(input.taxonomyId));
    }

    if (input.shopLocation) {
        url.searchParams.set('shop_location', input.shopLocation);
    }

    if (input.legacy !== undefined) {
        url.searchParams.set('legacy', String(input.legacy));
    }

    return url.toString();
};

const extractThumbnailUrlFromImage = (image: unknown): string | null => {
    if (typeof image !== 'object' || image === null) {
        return null;
    }

    const record = image as Record<string, unknown>;
    const thumbnailUrl = record.url_170x135 ?? record.url_75x75 ?? null;

    return typeof thumbnailUrl === 'string' ? thumbnailUrl : null;
};

const extractThumbnailUrl = (listing: z.infer<typeof listingSchema>): string | null => {
    const thumbnailFromMainImage = extractThumbnailUrlFromImage(listing.main_image);

    if (thumbnailFromMainImage) {
        return thumbnailFromMainImage;
    }

    if (!listing.images || listing.images.length === 0) {
        return null;
    }

    return extractThumbnailUrlFromImage(listing.images[0]);
};

const toResponse = (parsed: z.infer<typeof responseSchema>): FindAllListingsActiveBridgeResponse => {
    return {
        count: parsed.count,
        results: parsed.results.map((item) => ({
            listingId: String(item.listing_id),
            price: item.price
                ? {
                      amount: item.price.amount,
                      currencyCode: item.price.currency_code,
                      divisor: item.price.divisor
                  }
                : null,
            shopId: item.shop_id === null || item.shop_id === undefined ? null : String(item.shop_id),
            thumbnailUrl: extractThumbnailUrl(item),
            title: item.title,
            url: item.url ?? null
        }))
    };
};

export const findAllListingsActive = async (
    input: FindAllListingsActiveBridgeInput
): Promise<FindAllListingsActiveBridgeResponse> => {
    const parsedInput = inputSchema.safeParse(input);

    if (!parsedInput.success) {
        throw new EtsyFindAllListingsActiveBridgeError(
            'Invalid findAllListingsActive bridge input.',
            400,
            ''
        );
    }

    const response = await fetchEtsyApi({
        init: {
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${parsedInput.data.accessToken}`,
                'x-api-key': getEtsyApiKeyHeaderValue()
            },
            method: 'GET'
        },
        url: buildEndpoint(parsedInput.data)
    });

    const rawBody = await response.text();

    if (!response.ok) {
        throw new EtsyFindAllListingsActiveBridgeError(
            extractErrorMessage(rawBody, response.status),
            response.status,
            rawBody
        );
    }

    const parsedJson = tryParseJson(rawBody) ?? {};
    const parsedBody = responseSchema.safeParse(parsedJson);

    if (!parsedBody.success) {
        throw new EtsyFindAllListingsActiveBridgeError(
            'Etsy findAllListingsActive response was missing required fields.',
            response.status,
            rawBody
        );
    }

    return toResponse(parsedBody.data);
};

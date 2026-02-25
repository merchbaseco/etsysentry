import { z } from 'zod';
import { fetchEtsyApi } from '../fetch-etsy-api';
import { getEtsyApiKeyHeaderValue } from '../get-etsy-api-key-header-value';

const getListingIncludeSchema = z.enum([
    'Shipping',
    'Images',
    'Shop',
    'User',
    'Translations',
    'Inventory',
    'Videos',
    'Personalization'
]);

const etsyListingStateSchema = z.enum([
    'active',
    'inactive',
    'sold_out',
    'draft',
    'expired',
    'edit'
]);
const listingStateSchema = z.enum(['active', 'inactive', 'sold_out', 'draft', 'expired']);
const listingTypeSchema = z.enum(['physical', 'download', 'both']);

const moneySchema = z.object({
    amount: z.coerce.number().int(),
    currency_code: z.string().min(1),
    divisor: z.coerce.number().int().positive()
});

const shopSchema = z
    .object({
        name: z.string().min(1).nullable().optional(),
        shop_id: z.coerce.number().int().positive().nullable().optional(),
        shop_name: z.string().min(1).nullable().optional()
    })
    .passthrough();

const listingResponseSchema = z
    .object({
        created_timestamp: z.coerce.number().int().nullable().optional(),
        creation_timestamp: z.coerce.number().int().nullable().optional(),
        description: z.string().nullable().optional(),
        images: z.array(z.unknown()).nullable().optional(),
        inventory: z.unknown().nullable().optional(),
        language: z.string().nullable().optional(),
        last_modified_timestamp: z.coerce.number().int().nullable().optional(),
        listing_id: z.coerce.number().int().positive(),
        listing_type: listingTypeSchema.nullable().optional(),
        materials: z.array(z.string()).nullable().optional(),
        num_favorers: z.coerce.number().int().nonnegative().nullable().optional(),
        original_creation_timestamp: z.coerce.number().int().nullable().optional(),
        personalization: z.unknown().nullable().optional(),
        price: moneySchema.nullable().optional(),
        quantity: z.coerce.number().int().nonnegative().nullable().optional(),
        shipping_profile: z.unknown().nullable().optional(),
        shop: shopSchema.nullable().optional(),
        shop_id: z.coerce.number().int().positive().nullable().optional(),
        skus: z.array(z.string()).nullable().optional(),
        state: etsyListingStateSchema,
        state_timestamp: z.coerce.number().int().nullable().optional(),
        suggested_title: z.string().nullable().optional(),
        tags: z.array(z.string()).nullable().optional(),
        title: z.string().min(1),
        translations: z.array(z.unknown()).nullable().optional(),
        updated_timestamp: z.coerce.number().int().nullable().optional(),
        url: z.string().url().nullable().optional(),
        user: z.unknown().nullable().optional(),
        user_id: z.coerce.number().int().positive().nullable().optional(),
        videos: z.array(z.unknown()).nullable().optional(),
        views: z.coerce.number().int().nonnegative().nullable().optional()
    })
    .passthrough();

const getListingInputSchema = z.object({
    accessToken: z.string().min(1),
    allowSuggestedTitle: z.boolean().optional(),
    includes: z.array(getListingIncludeSchema).optional(),
    language: z.string().min(1).optional(),
    legacy: z.boolean().optional(),
    listingId: z.coerce.number().int().positive()
});

const etsyErrorSchema = z
    .object({
        error: z.string().optional(),
        error_description: z.string().optional(),
        message: z.string().optional()
    })
    .passthrough();

export type EtsyGetListingInclude = z.infer<typeof getListingIncludeSchema>;
export type EtsyListingState = z.infer<typeof listingStateSchema>;
export type EtsyListingType = z.infer<typeof listingTypeSchema>;

export type GetListingBridgeInput = {
    accessToken: string;
    allowSuggestedTitle?: boolean;
    includes?: EtsyGetListingInclude[];
    language?: string;
    legacy?: boolean;
    listingId: string | number;
};

export type GetListingBridgeResponse = {
    createdTimestamp: number | null;
    creationTimestamp: number | null;
    description: string | null;
    etsyState: EtsyListingState;
    images: unknown[];
    inventory: unknown | null;
    language: string | null;
    lastModifiedTimestamp: number | null;
    listingId: string;
    listingType: EtsyListingType | null;
    materials: string[];
    numFavorers: number | null;
    originalCreationTimestamp: number | null;
    personalization: unknown | null;
    price: {
        amount: number;
        currencyCode: string;
        divisor: number;
    } | null;
    quantity: number | null;
    shippingProfile: unknown | null;
    shop: unknown | null;
    shopId: string | null;
    shopName: string | null;
    skus: string[];
    stateTimestamp: number | null;
    suggestedTitle: string | null;
    tags: string[];
    thumbnailUrl: string | null;
    title: string;
    translations: unknown[];
    updatedTimestamp: number | null;
    url: string | null;
    user: unknown | null;
    userId: string | null;
    videos: unknown[];
    views: number | null;
};

export class EtsyGetListingBridgeError extends Error {
    readonly responseBody: string;
    readonly statusCode: number;

    constructor(message: string, statusCode: number, responseBody: string) {
        super(message);
        this.name = 'EtsyGetListingBridgeError';
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
            `Etsy getListing failed with HTTP ${statusCode}.`
        );
    }

    return `Etsy getListing failed with HTTP ${statusCode}.`;
};

const buildEndpoint = (input: z.infer<typeof getListingInputSchema>): string => {
    const url = new URL(`https://openapi.etsy.com/v3/application/listings/${input.listingId}`);

    if (input.includes && input.includes.length > 0) {
        for (const include of input.includes) {
            url.searchParams.append('includes', include);
        }
    }

    if (input.language) {
        url.searchParams.set('language', input.language);
    }

    if (input.legacy !== undefined) {
        url.searchParams.set('legacy', String(input.legacy));
    }

    if (input.allowSuggestedTitle !== undefined) {
        url.searchParams.set('allow_suggested_title', String(input.allowSuggestedTitle));
    }

    return url.toString();
};

const extractThumbnailUrl = (images: unknown[] | null | undefined): string | null => {
    if (!images || images.length === 0) {
        return null;
    }

    const first = images[0];

    if (typeof first !== 'object' || first === null) {
        return null;
    }

    const record = first as Record<string, unknown>;
    const url = record.url_170x135 ?? record.url_75x75 ?? null;

    return typeof url === 'string' ? url : null;
};

const normalizeListingState = (
    state: z.infer<typeof etsyListingStateSchema>
): EtsyListingState => {
    if (state === 'edit') {
        return 'inactive';
    }

    return state;
};

const toResponse = (
    parsed: z.infer<typeof listingResponseSchema>
): GetListingBridgeResponse => {
    const normalizedShopId = parsed.shop_id ?? parsed.shop?.shop_id ?? null;

    return {
        createdTimestamp: parsed.created_timestamp ?? null,
        creationTimestamp: parsed.creation_timestamp ?? null,
        description: parsed.description ?? null,
        etsyState: normalizeListingState(parsed.state),
        images: parsed.images ?? [],
        inventory: parsed.inventory ?? null,
        language: parsed.language ?? null,
        lastModifiedTimestamp: parsed.last_modified_timestamp ?? null,
        listingId: String(parsed.listing_id),
        listingType: parsed.listing_type ?? null,
        materials: parsed.materials ?? [],
        numFavorers: parsed.num_favorers ?? null,
        originalCreationTimestamp: parsed.original_creation_timestamp ?? null,
        personalization: parsed.personalization ?? null,
        price: parsed.price
            ? {
                  amount: parsed.price.amount,
                  currencyCode: parsed.price.currency_code,
                  divisor: parsed.price.divisor
              }
            : null,
        quantity: parsed.quantity ?? null,
        shippingProfile: parsed.shipping_profile ?? null,
        shop: parsed.shop ?? null,
        shopId:
            normalizedShopId !== undefined && normalizedShopId !== null
                ? String(normalizedShopId)
                : null,
        shopName: parsed.shop?.shop_name ?? parsed.shop?.name ?? null,
        skus: parsed.skus ?? [],
        stateTimestamp: parsed.state_timestamp ?? null,
        suggestedTitle: parsed.suggested_title ?? null,
        tags: parsed.tags ?? [],
        thumbnailUrl: extractThumbnailUrl(parsed.images),
        title: parsed.title,
        translations: parsed.translations ?? [],
        updatedTimestamp: parsed.updated_timestamp ?? null,
        url: parsed.url ?? null,
        user: parsed.user ?? null,
        userId:
            parsed.user_id !== undefined && parsed.user_id !== null
                ? String(parsed.user_id)
                : null,
        videos: parsed.videos ?? [],
        views: parsed.views ?? null
    };
};

export const getListing = async (
    input: GetListingBridgeInput
): Promise<GetListingBridgeResponse> => {
    const parsedInput = getListingInputSchema.safeParse(input);

    if (!parsedInput.success) {
        throw new EtsyGetListingBridgeError('Invalid getListing bridge input.', 400, '');
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
        throw new EtsyGetListingBridgeError(
            extractErrorMessage(rawBody, response.status),
            response.status,
            rawBody
        );
    }

    const parsedJson = tryParseJson(rawBody) ?? {};
    const parsedBody = listingResponseSchema.safeParse(parsedJson);

    if (!parsedBody.success) {
        throw new EtsyGetListingBridgeError(
            'Etsy getListing response was missing required fields.',
            response.status,
            rawBody
        );
    }

    return toResponse(parsedBody.data);
};

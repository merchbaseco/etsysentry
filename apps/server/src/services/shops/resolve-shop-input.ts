import { TRPCError } from '@trpc/server';
import { EtsyFindShopsBridgeError, findShops } from '../etsy/bridges/find-shops';
import {
    EtsyGetShopBridgeError,
    type GetShopBridgeResponse,
    getShop,
} from '../etsy/bridges/get-shop';
import { recordEtsyApiCallBestEffort } from '../etsy/record-etsy-api-call';

const DIGITS_ONLY_REGEX = /^\d+$/;
const ETSY_SHOP_PATH_REGEX = /\/shop\/([^/]+)(?:\/|$)/i;
const SHOP_NAME_NORMALIZATION_REGEX = /[\s_-]+/g;

export type ResolvedShop = Pick<
    GetShopBridgeResponse,
    | 'shopId'
    | 'shopName'
    | 'url'
    | 'activeListingCount'
    | 'numFavorers'
    | 'soldCount'
    | 'reviewCount'
>;

const normalizeShopNameForLookup = (value: string): string => {
    return value.trim().toLowerCase().replace(SHOP_NAME_NORMALIZATION_REGEX, '');
};

const parseShopIdentifier = (
    rawInput: string
):
    | {
          type: 'id';
          value: string;
      }
    | {
          type: 'name';
          value: string;
      }
    | null => {
    const trimmed = rawInput.trim();

    if (trimmed.length === 0) {
        return null;
    }

    if (DIGITS_ONLY_REGEX.test(trimmed)) {
        return {
            type: 'id',
            value: trimmed,
        };
    }

    try {
        const url = new URL(trimmed);

        if (!url.hostname.toLowerCase().includes('etsy.com')) {
            return null;
        }

        const shopIdFromQuery = url.searchParams.get('shop_id');

        if (shopIdFromQuery && DIGITS_ONLY_REGEX.test(shopIdFromQuery)) {
            return {
                type: 'id',
                value: shopIdFromQuery,
            };
        }

        const match = url.pathname.match(ETSY_SHOP_PATH_REGEX);

        if (match?.[1]) {
            return {
                type: 'name',
                value: decodeURIComponent(match[1]),
            };
        }

        return null;
    } catch {
        return {
            type: 'name',
            value: trimmed,
        };
    }
};

const mapBridgeErrorToTrpcError = (
    error: EtsyGetShopBridgeError | EtsyFindShopsBridgeError
): TRPCError => {
    if (error.statusCode === 404) {
        return new TRPCError({
            code: 'NOT_FOUND',
            message: 'Etsy shop was not found.',
        });
    }

    if (error.statusCode === 400) {
        return new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
        });
    }

    return new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message,
    });
};

export const resolveShopFromInput = async (params: {
    shopInput: string;
    clerkUserId: string;
    accountId: string;
}): Promise<ResolvedShop> => {
    const parsed = parseShopIdentifier(params.shopInput);

    if (!parsed) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Shop must be an Etsy shop URL, numeric shop id, or shop name.',
        });
    }

    try {
        if (parsed.type === 'id') {
            await recordEtsyApiCallBestEffort({
                clerkUserId: params.clerkUserId,
                endpoint: 'getShop',
                accountId: params.accountId,
            });

            return await getShop({
                shopId: parsed.value,
            });
        }

        await recordEtsyApiCallBestEffort({
            clerkUserId: params.clerkUserId,
            endpoint: 'findShops',
            accountId: params.accountId,
        });

        const findResponse = await findShops({
            limit: 25,
            offset: 0,
            shopName: parsed.value,
        });

        const normalizedInput = normalizeShopNameForLookup(parsed.value);
        const exactMatch = findResponse.results.find((item) => {
            return normalizeShopNameForLookup(item.shopName) === normalizedInput;
        });
        const resolved = exactMatch ?? findResponse.results[0];

        if (!resolved) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Etsy shop was not found.',
            });
        }

        await recordEtsyApiCallBestEffort({
            clerkUserId: params.clerkUserId,
            endpoint: 'getShop',
            accountId: params.accountId,
        });

        return await getShop({
            shopId: resolved.shopId,
        });
    } catch (error) {
        if (error instanceof TRPCError) {
            throw error;
        }

        if (error instanceof EtsyFindShopsBridgeError || error instanceof EtsyGetShopBridgeError) {
            throw mapBridgeErrorToTrpcError(error);
        }

        throw error;
    }
};

import { TRPCError } from '@trpc/server';
import {
    EtsyFindAllActiveListingsByShopBridgeError,
    type FindAllActiveListingsByShopBridgeResponse,
    findAllActiveListingsByShop,
} from '../etsy/bridges/find-all-active-listings-by-shop';
import {
    EtsyGetShopBridgeError,
    type GetShopBridgeResponse,
    getShop,
} from '../etsy/bridges/get-shop';
import { recordEtsyApiCallBestEffort } from '../etsy/record-etsy-api-call';

const MAX_PAGE_SIZE = 100;

export type ShopListingResult = FindAllActiveListingsByShopBridgeResponse['results'][number];

const mapBridgeErrorToTrpcError = (
    error: EtsyGetShopBridgeError | EtsyFindAllActiveListingsByShopBridgeError
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

export const fetchShopFromEtsy = async (params: {
    clerkUserId: string;
    etsyShopId: string;
    accountId: string;
}): Promise<GetShopBridgeResponse> => {
    try {
        await recordEtsyApiCallBestEffort({
            clerkUserId: params.clerkUserId,
            endpoint: 'getShop',
            accountId: params.accountId,
        });

        return await getShop({
            shopId: params.etsyShopId,
        });
    } catch (error) {
        if (error instanceof EtsyGetShopBridgeError) {
            throw mapBridgeErrorToTrpcError(error);
        }

        throw error;
    }
};

export const fetchChangedActiveListings = async (params: {
    clerkUserId: string;
    etsyShopId: string;
    previousWatermark: number | null;
    accountId: string;
}): Promise<ShopListingResult[]> => {
    const listingsById = new Map<string, ShopListingResult>();
    let offset = 0;

    for (;;) {
        try {
            await recordEtsyApiCallBestEffort({
                clerkUserId: params.clerkUserId,
                endpoint: 'findAllActiveListingsByShop',
                accountId: params.accountId,
            });

            const response = await findAllActiveListingsByShop({
                limit: MAX_PAGE_SIZE,
                offset,
                shopId: params.etsyShopId,
                sortOn: 'updated',
                sortOrder: 'desc',
            });

            if (response.results.length === 0) {
                break;
            }

            let hitBelowWatermark = false;

            for (const listing of response.results) {
                if (
                    params.previousWatermark !== null &&
                    listing.updatedTimestamp !== null &&
                    listing.updatedTimestamp < params.previousWatermark
                ) {
                    hitBelowWatermark = true;
                    break;
                }

                if (!listingsById.has(listing.listingId)) {
                    listingsById.set(listing.listingId, listing);
                }
            }

            if (hitBelowWatermark || response.results.length < MAX_PAGE_SIZE) {
                break;
            }

            offset += response.results.length;
        } catch (error) {
            if (error instanceof EtsyFindAllActiveListingsByShopBridgeError) {
                throw mapBridgeErrorToTrpcError(error);
            }

            throw error;
        }
    }

    return [...listingsById.values()];
};

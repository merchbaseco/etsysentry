const ETSY_LISTING_RENEWAL_WINDOW_SECONDS = 60 * 60 * 24 * 120;

export interface ListingHistorySalesPoint {
    endingTimestamp: number | null;
    quantity: number | null;
}

export interface ListingHistorySalesMetric {
    estimatedSoldCount: number;
    estimatedSoldDelta: number;
}

export const toQuantityDrop = (params: {
    currentQuantity: number | null;
    previousQuantity: number | null;
}): number => {
    if (params.currentQuantity === null || params.previousQuantity === null) {
        return 0;
    }

    return Math.max(0, params.previousQuantity - params.currentQuantity);
};

export const toRenewalCount = (params: {
    currentEndingTimestamp: number | null;
    previousEndingTimestamp: number | null;
}): number => {
    if (params.currentEndingTimestamp === null || params.previousEndingTimestamp === null) {
        return 0;
    }

    if (params.currentEndingTimestamp <= params.previousEndingTimestamp) {
        return 0;
    }

    const endingTimestampDelta = params.currentEndingTimestamp - params.previousEndingTimestamp;

    return Math.max(1, Math.round(endingTimestampDelta / ETSY_LISTING_RENEWAL_WINDOW_SECONDS));
};

export const deriveListingHistorySales = (
    points: ListingHistorySalesPoint[]
): ListingHistorySalesMetric[] => {
    let previousPoint: ListingHistorySalesPoint | null = null;
    let runningEstimatedSoldCount = 0;

    return points.map((point) => {
        const quantityDrop = toQuantityDrop({
            currentQuantity: point.quantity,
            previousQuantity: previousPoint?.quantity ?? null,
        });
        const renewalCount = toRenewalCount({
            currentEndingTimestamp: point.endingTimestamp,
            previousEndingTimestamp: previousPoint?.endingTimestamp ?? null,
        });
        const renewalSoldDelta = quantityDrop === 0 ? renewalCount : 0;
        const estimatedSoldDelta = quantityDrop + renewalSoldDelta;
        runningEstimatedSoldCount += estimatedSoldDelta;
        previousPoint = point;

        return {
            estimatedSoldCount: runningEstimatedSoldCount,
            estimatedSoldDelta,
        };
    });
};

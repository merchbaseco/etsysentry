const DIGITAL_LISTING_TYPES = new Set(['download', 'both']);

export const isExcludedDigitalListingType = (listingType: string | null): boolean => {
    if (listingType === null) {
        return false;
    }

    return DIGITAL_LISTING_TYPES.has(listingType.toLowerCase());
};

export const buildDigitalListingTrackingErrorMessage = (): string => {
    return 'Digital listings are not eligible for tracking.';
};

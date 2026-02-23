export const convertPriceToUsd = (params: {
    currencyCode: string;
    ratesByCurrencyCode: Record<string, number> | null;
    value: number;
}): number | null => {
    if (!Number.isFinite(params.value) || params.value < 0) {
        return null;
    }

    if (params.currencyCode === 'USD') {
        return params.value;
    }

    if (!params.ratesByCurrencyCode) {
        return null;
    }

    const currencyRate = params.ratesByCurrencyCode[params.currencyCode];

    if (!Number.isFinite(currencyRate) || currencyRate <= 0) {
        return null;
    }

    return params.value / currencyRate;
};

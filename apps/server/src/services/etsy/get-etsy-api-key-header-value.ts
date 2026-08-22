import { env } from '../../config/env';

export const getEtsyApiKeyHeaderValue = (): string => {
    if (env.ETSYSENTRY_ETSY_API_SHARED_SECRET) {
        return `${env.ETSYSENTRY_ETSY_API_KEY}:${env.ETSYSENTRY_ETSY_API_SHARED_SECRET}`;
    }

    return env.ETSYSENTRY_ETSY_API_KEY;
};

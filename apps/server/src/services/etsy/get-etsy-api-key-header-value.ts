import { env } from '../../config/env';

export const getEtsyApiKeyHeaderValue = (): string => {
    if (env.ETSY_API_SHARED_SECRET) {
        return `${env.ETSY_API_KEY}:${env.ETSY_API_SHARED_SECRET}`;
    }

    return env.ETSY_API_KEY;
};

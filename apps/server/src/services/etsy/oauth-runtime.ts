import { env } from '../../config/env';
import { EtsyOAuthStateStore } from './oauth-state-store';
import { EtsyOAuthTokenStore } from './token-store';

export const etsyOAuthStateStore = new EtsyOAuthStateStore(env.ETSY_OAUTH_STATE_TTL_MS);
export const etsyOAuthTokenStore = new EtsyOAuthTokenStore();

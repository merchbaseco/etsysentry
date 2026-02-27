import { env } from '../../config/env';
import { etsyOAuthConnectionStore as baseEtsyOAuthConnectionStore } from './connection-store';
import { EtsyOAuthStateStore } from './oauth-state-store';

export const etsyOAuthStateStore = new EtsyOAuthStateStore(env.ETSY_OAUTH_STATE_TTL_MS);
export const etsyOAuthConnectionStore = baseEtsyOAuthConnectionStore;

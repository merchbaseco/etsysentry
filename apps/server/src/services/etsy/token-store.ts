export type EtsyOAuthTokens = {
    accessToken: string;
    expiresAt: Date;
    refreshToken: string;
    scopes: string[];
    tokenType: string;
};

export class EtsyOAuthTokenStore {
    private readonly tokensBySessionId = new Map<string, EtsyOAuthTokens>();

    get(oauthSessionId: string): EtsyOAuthTokens | null {
        const tokens = this.tokensBySessionId.get(oauthSessionId);

        if (!tokens) {
            return null;
        }

        return {
            ...tokens,
            expiresAt: new Date(tokens.expiresAt.getTime()),
            scopes: [...tokens.scopes]
        };
    }

    set(oauthSessionId: string, tokens: EtsyOAuthTokens): void {
        this.tokensBySessionId.set(oauthSessionId, {
            ...tokens,
            expiresAt: new Date(tokens.expiresAt.getTime()),
            scopes: [...tokens.scopes]
        });
    }

    clear(oauthSessionId: string): void {
        this.tokensBySessionId.delete(oauthSessionId);
    }
}

import { randomBytes } from 'node:crypto';

export type EtsyOAuthStatePayload = {
    codeVerifier: string;
    oauthSessionId: string;
};

type EtsyOAuthStoredState = EtsyOAuthStatePayload & {
    createdAtMs: number;
};

const createState = (): string => {
    return randomBytes(32).toString('base64url');
};

export class EtsyOAuthStateStore {
    private readonly states = new Map<string, EtsyOAuthStoredState>();
    private readonly ttlMs: number;

    constructor(ttlMs: number) {
        this.ttlMs = ttlMs;
    }

    issue(payload: EtsyOAuthStatePayload): {
        expiresAt: Date;
        state: string;
    } {
        const createdAtMs = Date.now();
        const state = createState();

        this.pruneExpired(createdAtMs);
        this.states.set(state, {
            ...payload,
            createdAtMs
        });

        return {
            expiresAt: new Date(createdAtMs + this.ttlMs),
            state
        };
    }

    consume(state: string): EtsyOAuthStatePayload | null {
        const nowMs = Date.now();

        this.pruneExpired(nowMs);

        const found = this.states.get(state);
        if (!found) {
            return null;
        }

        this.states.delete(state);

        return {
            codeVerifier: found.codeVerifier,
            oauthSessionId: found.oauthSessionId
        };
    }

    private pruneExpired(nowMs: number): void {
        for (const [state, value] of this.states.entries()) {
            if (nowMs - value.createdAtMs > this.ttlMs) {
                this.states.delete(state);
            }
        }
    }
}

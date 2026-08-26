import { useSignIn } from '@clerk/clerk-react';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { getServerBaseUrl } from '@/lib/trpc-client';

/**
 * Signs a development session in as the shared Merchbase Dev Sign-In user.
 *
 * The development Clerk instance enables no password strategy, so there is no
 * form to fill: the server mints a single-use sign-in ticket for one fixed user
 * id and this exchanges it for a session. The server decides whether that is
 * allowed — it only arms the route for a non-production process pointed at a
 * loopback (seeded, disposable) database — so this side needs no configuration
 * of its own beyond being a development build. A `404` is the ordinary answer
 * on a local checkout pointed at the live database, and is not an error.
 *
 * The ticket never reaches the URL bar. Clerk also accepts one as a
 * `__clerk_ticket` query parameter on this origin, and `ClerkProvider` has
 * already consumed any such parameter by the time Clerk reports itself loaded —
 * so a leftover one is stripped from history here, spent or not.
 */

const DEV_SIGN_IN_TOKEN_PATH = '/auth/dev/clerk-sign-in-token';
const CLERK_TICKET_QUERY_PARAM = '__clerk_ticket';

/** Roughly fifteen seconds of backoff, which covers a cold API start. */
const SIGN_IN_RETRY_LIMIT = 4;

interface DevSignInTicketResponse {
    expiresInSeconds: number;
    ticket: string;
}

type SignInResource = NonNullable<ReturnType<typeof useSignIn>['signIn']>;
type SetActive = NonNullable<ReturnType<typeof useSignIn>['setActive']>;

/** A spent ticket sitting in the URL bar is still a credential in history. */
const stripClerkTicketFromUrl = (): void => {
    const url = new URL(window.location.href);

    if (!url.searchParams.has(CLERK_TICKET_QUERY_PARAM)) {
        return;
    }

    url.searchParams.delete(CLERK_TICKET_QUERY_PARAM);
    window.history.replaceState({}, '', url.toString());
};

const requestDevSignInTicket = async (): Promise<string | null> => {
    const response = await fetch(`${getServerBaseUrl()}${DEV_SIGN_IN_TOKEN_PATH}`, {
        method: 'POST',
    });

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(`Dev sign-in ticket request failed with ${response.status}.`);
    }

    const payload = (await response.json()) as DevSignInTicketResponse;

    if (typeof payload.ticket !== 'string' || payload.ticket.length === 0) {
        throw new Error('Dev sign-in ticket response carried no ticket.');
    }

    return payload.ticket;
};

const activateDevSession = async (params: {
    setActive: SetActive;
    signIn: SignInResource;
}): Promise<void> => {
    stripClerkTicketFromUrl();

    const ticket = await requestDevSignInTicket();

    if (!ticket) {
        return;
    }

    const attempt = await params.signIn.create({ strategy: 'ticket', ticket });

    if (attempt.status !== 'complete' || !attempt.createdSessionId) {
        throw new Error(`Dev sign-in attempt ended as ${attempt.status ?? 'unknown'}.`);
    }

    await params.setActive({ session: attempt.createdSessionId });
};

export const useDevAutoSignIn = (): void => {
    const { isLoaded, setActive, signIn } = useSignIn();
    const hasAttempted = useRef(false);

    const { mutate } = useMutation({
        mutationFn: activateDevSession,
        onError: (error) => {
            console.warn('[dev-auto-sign-in] Could not sign in automatically.', error);
        },
        // A cloud session starts the API and the website together, so the first
        // request can land before the API is listening. Each retry mints a fresh
        // ticket, which is also the right answer for a spent one. A 404 is not
        // an error and never reaches this.
        retry: SIGN_IN_RETRY_LIMIT,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    });

    useEffect(() => {
        if (!(import.meta.env.DEV && isLoaded && signIn && setActive)) {
            return;
        }

        if (hasAttempted.current) {
            return;
        }

        hasAttempted.current = true;
        mutate({ setActive, signIn });
    }, [isLoaded, mutate, setActive, signIn]);
};

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { ThemeProvider } from './components/theme-provider';
import { shouldPersistDashboardSummaryQuery } from './lib/dashboard-summary-persistence';
import { queryClient } from './lib/trpc-client';
import './styles/global.css';

type SessionState =
    | { status: 'loading' }
    | { status: 'authenticated'; merchbaseUserId: string }
    | { status: 'unauthenticated' }
    | { status: 'unavailable' };

interface SessionResponse {
    authenticated?: unknown;
    merchbaseUserId?: unknown;
}

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error('Root element not found');
}

const DASHBOARD_SUMMARY_QUERY_CACHE_KEY = 'etsysentry:dashboard-summary-query-cache:v1';
const DASHBOARD_SUMMARY_QUERY_CACHE_MAX_AGE_MS = 10 * 60_000;
const MERCHBASE_USER_ID_SHAPE = /^mbu_[A-Za-z0-9_-]{1,120}$/u;

const getPersistenceStorage = (): Storage | undefined => {
    try {
        return window.localStorage;
    } catch {
        return undefined;
    }
};

const requestSession = async (): Promise<SessionState> => {
    try {
        const response = await fetch('/auth/session', {
            cache: 'no-store',
            credentials: 'same-origin',
            method: 'GET',
            redirect: 'manual',
        });
        if (response.status === 401 || response.status === 403) {
            return { status: 'unauthenticated' };
        }
        if (!response.ok) {
            return { status: 'unavailable' };
        }

        const payload = (await response.json()) as SessionResponse;
        if (
            payload.authenticated !== true ||
            typeof payload.merchbaseUserId !== 'string' ||
            !MERCHBASE_USER_ID_SHAPE.test(payload.merchbaseUserId)
        ) {
            return { status: 'unauthenticated' };
        }

        return {
            merchbaseUserId: payload.merchbaseUserId,
            status: 'authenticated',
        };
    } catch {
        return { status: 'unavailable' };
    }
};

const AuthenticatedApp = ({ merchbaseUserId }: { merchbaseUserId: string }) => {
    const dashboardSummaryPersister = createSyncStoragePersister({
        key: `${DASHBOARD_SUMMARY_QUERY_CACHE_KEY}:${merchbaseUserId}`,
        storage: getPersistenceStorage(),
        throttleTime: 1000,
    });

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
                dehydrateOptions: {
                    shouldDehydrateQuery: (query) =>
                        shouldPersistDashboardSummaryQuery(query.queryKey),
                },
                maxAge: DASHBOARD_SUMMARY_QUERY_CACHE_MAX_AGE_MS,
                persister: dashboardSummaryPersister,
            }}
        >
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                <App />
            </ThemeProvider>
        </PersistQueryClientProvider>
    );
};

const SessionMessage = ({ status }: { status: 'unauthenticated' | 'unavailable' }) => (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <section className="max-w-xl rounded border border-border bg-card p-5">
            <h1 className="font-semibold text-base text-foreground">
                {status === 'unauthenticated'
                    ? 'Sign-in required'
                    : 'EtsySentry could not verify your session'}
            </h1>
            <p className="mt-2 text-muted-foreground text-sm">
                {status === 'unauthenticated'
                    ? 'Sign in through Cloudflare Access, then reload this page.'
                    : 'Refresh the page after Cloudflare Access and the API are available.'}
            </p>
            <button
                className="mt-4 rounded border border-border px-3 py-2 text-foreground text-sm"
                onClick={() => window.location.reload()}
                type="button"
            >
                Reload
            </button>
        </section>
    </main>
);

const AccessBootstrap = () => {
    const [session, setSession] = useState<SessionState>({ status: 'loading' });

    useEffect(() => {
        let isStopped = false;
        requestSession().then((result) => {
            if (!isStopped) {
                setSession(result);
            }
        });

        return () => {
            isStopped = true;
        };
    }, []);

    if (session.status === 'authenticated') {
        return <AuthenticatedApp merchbaseUserId={session.merchbaseUserId} />;
    }
    if (session.status === 'unauthenticated' || session.status === 'unavailable') {
        return <SessionMessage status={session.status} />;
    }

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                <main className="flex min-h-screen items-center justify-center bg-background text-muted-foreground text-sm">
                    Checking your session…
                </main>
            </ThemeProvider>
        </QueryClientProvider>
    );
};

createRoot(rootElement).render(
    <StrictMode>
        <AccessBootstrap />
    </StrictMode>
);

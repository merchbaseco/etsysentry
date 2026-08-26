import { ClerkProvider, SignedIn, SignedOut, SignIn, useAuth } from '@clerk/clerk-react';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StrictMode, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { DevAutoSignIn } from './components/dev-auto-sign-in';
import { ThemeProvider } from './components/theme-provider';
import { clearCachedAdminStatus } from './lib/admin-api';
import { shouldPersistDashboardSummaryQuery } from './lib/dashboard-summary-persistence';
import { configureTrpcAuthTokenGetter, queryClient } from './lib/trpc-client';
import './styles/global.css';

const clerkPublishableKey = (
    import.meta.env.VITE_MERCHBASE_CLERK_PUBLISHABLE_KEY as string | undefined
)?.trim();

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error('Root element not found');
}

const DASHBOARD_SUMMARY_QUERY_CACHE_KEY = 'etsysentry:dashboard-summary-query-cache:v1';
const DASHBOARD_SUMMARY_QUERY_CACHE_MAX_AGE_MS = 10 * 60_000;

const getPersistenceStorage = (): Storage | undefined => {
    try {
        return window.localStorage;
    } catch {
        return undefined;
    }
};

const dashboardSummaryPersister = createSyncStoragePersister({
    key: DASHBOARD_SUMMARY_QUERY_CACHE_KEY,
    storage: getPersistenceStorage(),
    throttleTime: 1000,
});

const MissingConfig = () => {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-6">
            <div className="max-w-xl rounded border border-border bg-card p-5">
                <h1 className="font-semibold text-base text-foreground">
                    EtsySentry is misconfigured
                </h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    Missing <code className="font-mono">VITE_MERCHBASE_CLERK_PUBLISHABLE_KEY</code>{' '}
                    in your env.
                </p>
            </div>
        </div>
    );
};

const AuthenticatedApp = () => {
    const { getToken } = useAuth();
    const getAuthToken = useCallback(async () => {
        return (await getToken()) ?? null;
    }, [getToken]);

    useEffect(() => {
        configureTrpcAuthTokenGetter(getAuthToken);

        return () => {
            configureTrpcAuthTokenGetter(null);
            clearCachedAdminStatus();
        };
    }, [getAuthToken]);

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
                dehydrateOptions: {
                    shouldDehydrateQuery: (query) => {
                        return shouldPersistDashboardSummaryQuery(query.queryKey);
                    },
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

createRoot(rootElement).render(
    <StrictMode>
        {clerkPublishableKey ? (
            <ClerkProvider publishableKey={clerkPublishableKey}>
                <SignedIn>
                    <AuthenticatedApp />
                </SignedIn>
                <SignedOut>
                    {/* Development only, and gated here as well as inside the hook so a
                        production bundle carries none of it. The signed-in tree gets its
                        query client from the persisting provider inside AuthenticatedApp,
                        which has not mounted yet. */}
                    {import.meta.env.DEV ? (
                        <QueryClientProvider client={queryClient}>
                            <DevAutoSignIn />
                        </QueryClientProvider>
                    ) : null}
                    <div className="flex min-h-screen items-center justify-center bg-background">
                        <SignIn />
                    </div>
                </SignedOut>
            </ClerkProvider>
        ) : (
            <MissingConfig />
        )}
    </StrictMode>
);

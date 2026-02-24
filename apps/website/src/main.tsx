import { ClerkProvider, SignedIn, SignedOut, SignIn, useAuth } from '@clerk/clerk-react';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { ThemeProvider } from './components/theme-provider';
import { clearCachedAdminStatus } from './lib/admin-api';
import { configureTrpcAuthTokenGetter, queryClient } from './lib/trpc-client';
import './styles/global.css';

const clerkPublishableKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined)?.trim();

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error('Root element not found');
}

const MissingConfig = () => {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-6">
            <div className="max-w-xl rounded border border-border bg-card p-5">
                <h1 className="text-base font-semibold text-foreground">EtsySentry is misconfigured</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Missing <code className="font-mono">VITE_CLERK_PUBLISHABLE_KEY</code> in your env.
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
        <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                <App />
            </ThemeProvider>
        </QueryClientProvider>
    );
};

createRoot(rootElement).render(
    <StrictMode>
        {!clerkPublishableKey ? (
            <MissingConfig />
        ) : (
            <ClerkProvider publishableKey={clerkPublishableKey}>
                <SignedIn>
                    <AuthenticatedApp />
                </SignedIn>
                <SignedOut>
                    <div className="flex min-h-screen items-center justify-center bg-background">
                        <SignIn />
                    </div>
                </SignedOut>
            </ClerkProvider>
        )}
    </StrictMode>
);

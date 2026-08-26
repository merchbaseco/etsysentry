import { useDevAutoSignIn } from '@/hooks/use-dev-auto-sign-in';

/**
 * Renders nothing; exists so the development auto sign-in runs while the app is
 * signed out. Mounted inside `SignedOut`, which is precisely the window in
 * which it has anything to do, and unmounts the moment a session is active.
 */
export const DevAutoSignIn = () => {
    useDevAutoSignIn();

    return null;
};

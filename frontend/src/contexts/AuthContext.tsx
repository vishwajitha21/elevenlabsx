/**
 * AuthContext.tsx
 *
 * Wraps Auth0 when configured; falls back to a demo admin user when
 * VITE_AUTH0_DOMAIN / VITE_AUTH0_CLIENT_ID are not set.
 *
 * KEY FIX: calls initApiService(getAccessTokenSilently) so api.ts can attach
 * a real JWT to every request.  In demo mode it wires a no-op getter that
 * returns "demo-token" — the backend demo-bypass middleware accepts this.
 */

import {
  createContext,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { initApiService, connectSocket } from '@/services/api';

// ─── Demo mode flag (exported so api.ts can also check it) ────────────────────
const HAS_AUTH0 = Boolean(
  import.meta.env.VITE_AUTH0_DOMAIN && import.meta.env.VITE_AUTH0_CLIENT_ID
);

export function isDemoMode(): boolean {
  return !HAS_AUTH0;
}

// ─── Context shape ────────────────────────────────────────────────────────────
interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemo: boolean;
  isAdmin: boolean;
  user: { name: string; email: string; sub?: string } | null;
  loginWithRedirect: (opts?: Record<string, unknown>) => void;
  logout: (opts?: Record<string, unknown>) => void;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  isLoading: true,
  isDemo: false,
  isAdmin: false,
  user: null,
  loginWithRedirect: () => {},
  logout: () => {},
});

// ─── Demo admin user ──────────────────────────────────────────────────────────
const DEMO_USER = {
  name: 'Alex Chen',
  email: 'alex@delivervault.dev',
  sub: 'demo-user',
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  if (!HAS_AUTH0) {
    return <DemoAuthProvider>{children}</DemoAuthProvider>;
  }
  return <Auth0AuthProvider>{children}</Auth0AuthProvider>;
}

/** Demo mode — no Auth0, admin user pre-loaded */
function DemoAuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Wire a demo token getter so api.ts can still build Authorization headers.
    // The backend demo-bypass middleware accepts "Bearer demo-token".
    initApiService(async () => 'demo-token');

    // Skip socket in demo (no backend required)
    // connectSocket();  // uncomment if running backend locally in demo mode
  }, []);

  const value: AuthContextValue = {
    isAuthenticated: true,   // demo = always authenticated
    isLoading: false,
    isDemo: true,
    isAdmin: true,
    user: DEMO_USER,
    loginWithRedirect: () => {},
    logout: () => {},
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Real Auth0 mode */
function Auth0AuthProvider({ children }: { children: ReactNode }) {
  const {
    isAuthenticated,
    isLoading,
    user: auth0User,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  // ── KEY FIX: wire the real JWT getter into api.ts IMMEDIATELY ───────
  // Doing this synchronously instead of in a useEffect ensures React Query
  // doesn't fire requests before _getToken is wired up!
  initApiService(async () => {
    return getAccessTokenSilently({
      authorizationParams: {
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      },
    });
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    // Connect socket with Auth0 token once authenticated
    connectSocket().catch(console.warn);
  }, [isAuthenticated, getAccessTokenSilently]);

  const user = auth0User
    ? {
        name: auth0User.name || auth0User.email || 'User',
        email: auth0User.email || '',
        sub: auth0User.sub,
      }
    : null;

  const value: AuthContextValue = {
    isAuthenticated,
    isLoading,
    isDemo: false,
    isAdmin: auth0User?.['https://delivervault.dev/roles']?.includes('admin') ?? false,
    user,
    loginWithRedirect: (opts) => loginWithRedirect(opts as Parameters<typeof loginWithRedirect>[0]),
    logout: (opts) => logout(opts as Parameters<typeof logout>[0]),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  return useContext(AuthContext);
}
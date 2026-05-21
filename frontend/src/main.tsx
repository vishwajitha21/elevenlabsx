import { Auth0Provider } from '@auth0/auth0-react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const domain = import.meta.env.VITE_AUTH0_DOMAIN || '';
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID || '';

function Root() {
  if (domain && clientId) {
    const onRedirectCallback = (appState?: { returnTo?: string }) => {
      window.history.replaceState(
        {},
        document.title,
        appState?.returnTo || '/dashboard'
      );
    };
    return (
      <Auth0Provider
        domain={domain}
        clientId={clientId}
        useRefreshTokens={true}
        cacheLocation="localstorage"
        authorizationParams={{
          redirect_uri: `${window.location.origin}/callback`,
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: 'openid profile email offline_access',
        }}
        onRedirectCallback={onRedirectCallback}
      >
        <App />
      </Auth0Provider>
    );
  }
  return <App />;
}

createRoot(document.getElementById('root')!).render(<Root />);

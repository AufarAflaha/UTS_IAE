'use client';

import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { useEffect, useState } from 'react';

function createApolloClient() {
  console.log('[APOLLO-CLIENT] Creating NEW Apollo Client instance...');
  
  const httpLink = createHttpLink({
    uri: 'http://localhost:3000/graphql',
  });

  const authLink = setContext((_, { headers }) => {
    // CRITICAL: Read token FRESH on every request
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    
    console.log('[APOLLO-AUTH] ===================');
    console.log('[APOLLO-AUTH] Reading token from localStorage');
    console.log('[APOLLO-AUTH] Token:', token ? `EXISTS (${token.substring(0, 30)}...)` : 'MISSING');
    console.log('[APOLLO-AUTH] Setting header:', token ? `Bearer ${token.substring(0, 30)}...` : 'NO AUTH HEADER');
    console.log('[APOLLO-AUTH] ===================');
    
    return {
      headers: {
        ...headers,
        authorization: token ? `Bearer ${token}` : '',
      }
    };
  });

  return new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache(),
  });
}

export function ApolloWrapper({ children }: { children: React.ReactNode }) {
  // Re-create client when token changes
  const [client, setClient] = useState(() => createApolloClient());
  
  useEffect(() => {
    // Listen for storage changes (login/logout from other tabs)
    const handleStorageChange = () => {
      console.log('[APOLLO-WRAPPER] localStorage changed, recreating client...');
      setClient(createApolloClient());
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom event from same tab
    const handleTokenChange = () => {
      console.log('[APOLLO-WRAPPER] Token changed in current tab, recreating client...');
      setClient(createApolloClient());
    };
    
    window.addEventListener('tokenChanged', handleTokenChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tokenChanged', handleTokenChange);
    };
  }, []);
  
  console.log('[APOLLO-WRAPPER] Rendering with client');
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}

'use client';

import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink, split, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';

// --- Klien HTTP ---
const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:3000/graphql',
});

// Middleware untuk menambahkan JWT ke request HTTP (Query/Mutation)
const authLink = setContext((_, { headers }) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  }
});

// --- Klien WebSocket ---
const wsLink = typeof window !== 'undefined'
  ? new GraphQLWsLink(createClient({
      url: process.env.NEXT_PUBLIC_GRAPHQL_URL?.replace('http', 'ws') || 'ws://localhost:3000/graphql',
      connectionParams: () => {
        // Mengirim token saat koneksi WebSocket dibuat
        const token = localStorage.getItem('token');
        return {
          Authorization: token ? `Bearer ${token}` : '',
        };
      },
    }))
  : null;

// --- Gabungkan Link ---
// Membagi lalu lintas: 
// - 'wsLink' untuk Subscriptions
// - 'authLink.concat(httpLink)' untuk Query/Mutation
const splitLink = typeof window !== 'undefined' && wsLink
  ? split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      authLink.concat(httpLink),
    )
  : authLink.concat(httpLink);


const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});

export function ApolloWrapper({ children }: { children: React.ReactNode }) {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_GATEWAY_URL: process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3000',
    NEXT_PUBLIC_GRAPHQL_URL: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql',
  },
}

module.exports = nextConfig
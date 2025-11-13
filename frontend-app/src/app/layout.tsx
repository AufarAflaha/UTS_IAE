import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../globals.css'
import { ApolloWrapper } from '@/lib/apollo-client'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Microservices Demo App',
  description: 'Demo app consuming REST and GraphQL APIs',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ApolloWrapper>
          {children}
        </ApolloWrapper>
      </body>
    </html>
  )
}
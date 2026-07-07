/**
 * @fileoverview Root client provider boundary. Holds the three cross-cutting
 * providers the whole dashboard needs: TanStack Query (server-state cache),
 * the nuqs adapter (mandatory in nuqs v2), and the Sonner toast portal.
 *
 * @layer app/providers
 */

'use client'

import { type ReactNode, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { Toaster } from '@/components/ui/sonner'

/** Default query stale-time in milliseconds. */
const DEFAULT_STALE_TIME_MS = 5_000

interface ProvidersProps {
  /** Page or nested layout content rendered inside the provider tree. */
  children: ReactNode
}

/**
 * Root client provider — TanStack Query cache, the nuqs URL-state adapter, and
 * the Sonner toast portal.
 *
 * @param props - Provider props.
 * @param props.children - The subtree to wrap.
 * @returns The provider tree enclosing `children` plus the toast portal.
 */
export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: DEFAULT_STALE_TIME_MS, refetchOnWindowFocus: false },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>{children}</NuqsAdapter>
      <Toaster theme="dark" position="bottom-right" closeButton />
    </QueryClientProvider>
  )
}

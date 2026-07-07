/**
 * @fileoverview Vault browser page — folder navigation, virtualized object
 * table, detail drawer, and lifecycle actions (delete, bulk-delete, copy).
 *
 * @module app/vault/page
 */

import { Suspense } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { VaultContent } from './vault-content'

/**
 * Vault browser page.
 *
 * @returns The vault browser inside the app shell.
 */
export default function VaultPage() {
  return (
    <AppShell wide>
      <Suspense>
        <VaultContent />
      </Suspense>
    </AppShell>
  )
}

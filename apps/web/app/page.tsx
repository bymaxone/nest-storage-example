/**
 * @fileoverview Overview dashboard page — bucket stats, config summary,
 * quick actions, and recent uploads.
 *
 * @module app/page
 */

import { AppShell } from '@/components/layout/AppShell'
import { OverviewContent } from './overview-content'

/**
 * Overview page — the top-level storage dashboard entry point.
 *
 * @returns The overview page inside the app shell.
 */
export default function OverviewPage() {
  return (
    <AppShell>
      <OverviewContent />
    </AppShell>
  )
}

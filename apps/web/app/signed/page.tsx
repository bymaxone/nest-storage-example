/**
 * @fileoverview Signed URLs page — GET link generator with TTL clamp visualization
 * and expiry countdown.
 *
 * @module app/signed/page
 */

import { AppShell } from '@/components/layout/AppShell'
import { SignedContent } from './signed-content'

/** Signed URLs page. */
export default function SignedPage() {
  return (
    <AppShell>
      <SignedContent />
    </AppShell>
  )
}

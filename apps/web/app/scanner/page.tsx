/**
 * @fileoverview Scanner lab page — marker-based scan verdicts, config view, and
 * post-upload removal proof.
 *
 * @module app/scanner/page
 */

import { AppShell } from '@/components/layout/AppShell'
import { ScannerContent } from './scanner-content'

/** Scanner lab page. */
export default function ScannerPage() {
  return (
    <AppShell>
      <ScannerContent />
    </AppShell>
  )
}

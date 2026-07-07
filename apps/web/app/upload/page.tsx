/**
 * @fileoverview Upload lab page — demonstrates all upload strategies: single-shot,
 * multipart (with progress sessions), stream, idempotent, and SSE override.
 *
 * @module app/upload/page
 */

import { AppShell } from '@/components/layout/AppShell'
import { UploadLabContent } from './upload-lab-content'

/** Upload lab page. */
export default function UploadPage() {
  return (
    <AppShell>
      <UploadLabContent />
    </AppShell>
  )
}

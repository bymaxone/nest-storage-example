/**
 * @fileoverview Direct upload page — presigned PUT from the browser, required-headers
 * inspector, confirm step, and multipart variant.
 *
 * @layer app/direct/page
 */

import { AppShell } from '@/components/layout/AppShell'
import { DirectUploadContent } from './direct-upload-content'

/** Direct upload page. */
export default function DirectPage() {
  return (
    <AppShell>
      <DirectUploadContent />
    </AppShell>
  )
}

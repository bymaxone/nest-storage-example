/**
 * @fileoverview Validation lab page — whitelist matrix, size limit, and
 * magic-byte forgery demo.
 *
 * @module app/validation/page
 */

import { AppShell } from '@/components/layout/AppShell'
import { ValidationContent } from './validation-content'

/** Validation lab page. */
export default function ValidationPage() {
  return (
    <AppShell>
      <ValidationContent />
    </AppShell>
  )
}

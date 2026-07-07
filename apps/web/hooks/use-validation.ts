/**
 * @fileoverview TanStack Query mutations for the validation lab: uploading
 * through each validation stage to trigger typed storage errors.
 * @layer hooks/use-validation
 */
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPostForm } from '@/lib/api-client'
import type { UploadResult } from '@bymax-one/nest-storage/shared'

/** Validation stage that selects which validator runs. */
export type ValidationPath = 'mime' | 'size' | 'magic'

/**
 * Mutation to upload a file through a specific validation stage.
 *
 * @returns TanStack mutation that calls POST /validation/upload?path=.
 */
export function useValidationUpload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, path }: { file: File; path: ValidationPath }) => {
      const form = new FormData()
      form.append('file', file)
      return apiPostForm<UploadResult>(`/validation/upload?path=${path}`, form)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault'] }),
  })
}

/**
 * @fileoverview Browser-side presigned PUT upload helpers. Signed URLs are
 * credentials: this module never logs them; any error message masks the
 * query string before throwing.
 * @layer lib/direct-upload
 */

/** Progress callback supplied by callers. Receives bytes uploaded and total. */
export type ProgressCallback = (loaded: number, total: number) => void

/** Strips the query string from a URL so presigned credentials are not logged. */
function maskSignedUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}[signed-query-redacted]`
  } catch {
    return '[url-redacted]'
  }
}

/**
 * Executes a presigned PUT using XMLHttpRequest so callers get upload progress.
 * The `requiredHeaders` issued with the signed URL are sent verbatim — they are
 * part of the SigV4 signature and MUST match exactly.
 *
 * @param signedUrl - Presigned PUT URL (treated as a credential; never logged).
 * @param requiredHeaders - Headers that must accompany the PUT.
 * @param body - File or Blob to upload.
 * @param onProgress - Optional callback receiving bytes loaded and total size.
 * @returns Resolved promise on HTTP 200; rejects with an error on failure.
 */
export function putWithHeaders(
  signedUrl: string,
  requiredHeaders: Record<string, string>,
  body: File | Blob,
  onProgress?: ProgressCallback,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const maskedUrl = maskSignedUrl(signedUrl)
    xhr.open('PUT', signedUrl)
    for (const [k, v] of Object.entries(requiredHeaders)) {
      xhr.setRequestHeader(k, v)
    }
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total)
      })
    }
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`PUT to ${maskedUrl} failed with status ${xhr.status}`))
      }
    })
    xhr.addEventListener('error', () =>
      reject(new Error(`Network error uploading to ${maskedUrl}`)),
    )
    xhr.send(body)
  })
}

/** Default part size for client-side multipart splits (5 MiB = S3 minimum). */
export const MULTIPART_PART_SIZE_BYTES = 5 * 1024 * 1024

/**
 * Splits a File into part slices of `partSize` bytes.
 *
 * @param file - The file to split.
 * @param partSize - Bytes per part (minimum 5 MiB for S3).
 * @returns Array of Blob slices in order.
 */
export function splitIntoParts(file: File, partSize: number = MULTIPART_PART_SIZE_BYTES): Blob[] {
  const parts: Blob[] = []
  let offset = 0
  while (offset < file.size) {
    parts.push(file.slice(offset, offset + partSize))
    offset += partSize
  }
  return parts
}

/**
 * Computes the number of parts required for a file at a given part size.
 *
 * @param fileSize - Total file size in bytes.
 * @param partSize - Bytes per part.
 * @returns Number of parts (minimum 1).
 */
export function partCount(fileSize: number, partSize: number = MULTIPART_PART_SIZE_BYTES): number {
  return Math.max(1, Math.ceil(fileSize / partSize))
}

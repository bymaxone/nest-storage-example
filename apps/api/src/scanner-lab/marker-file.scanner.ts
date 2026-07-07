/**
 * @fileoverview A deterministic, dependency-free file scanner for the demo. It
 * keys on INERT text markers only, never a real malware sample and never a live
 * antivirus test string, so it is safe to run anywhere. A body (pre-upload mode)
 * or the object key (post-upload mode) carrying `X-DEMO-INFECTED` is reported
 * infected;
 * `X-DEMO-UNKNOWN` is inconclusive; anything else is clean. Production adapters
 * (a ClamAV socket, AWS Macie) are the documented real path.
 * @layer api/scanner-lab
 */
import type { FileScanResult, IFileScanner } from '@bymax-one/nest-storage'

/** Inert marker that yields an `infected` verdict. NEVER real malware. */
export const INFECTED_MARKER = 'X-DEMO-INFECTED'
/** Inert marker that yields an `unknown` (inconclusive) verdict. */
export const UNKNOWN_MARKER = 'X-DEMO-UNKNOWN'
/** Threat name reported alongside an infected verdict. */
const THREAT_NAME = 'Demo.Marker.A'
/** Engine identifier surfaced in the scan result. */
const ENGINE_NAME = 'marker-demo'
/** Upper bound on bytes read from a body - keeps stream scanning bounded. */
const MAX_SCAN_BYTES = 4096

/** Scan input accepted by every `IFileScanner`. */
type ScanInput = Parameters<IFileScanner['scan']>[0]

/**
 * Deterministic marker scanner. In `pre-upload` mode it inspects a bounded
 * prefix of the body; in `post-upload` mode (no body reaches it) it inspects the
 * object KEY instead - a HEAD-less convention that keeps the verdict
 * deterministic without downloading the stored object.
 */
export class MarkerFileScanner implements IFileScanner {
  /**
   * Produces a verdict from the body (pre-upload) or the key (post-upload).
   *
   * @param input - The scan request; `body` is present only in pre-upload mode.
   * @returns The scan verdict keyed on the inert demo markers.
   */
  async scan(input: ScanInput): Promise<FileScanResult> {
    const haystack = input.body ? await this.readPrefix(input.body) : input.key
    return this.verdict(haystack)
  }

  /**
   * Maps text to a verdict: an infected marker wins over an unknown marker; the
   * absence of both is clean.
   *
   * @param text - The body prefix (pre-upload) or the object key (post-upload).
   * @returns The corresponding scan result.
   */
  private verdict(text: string): FileScanResult {
    if (text.includes(INFECTED_MARKER)) {
      return { status: 'infected', engine: ENGINE_NAME, threat: THREAT_NAME }
    }
    if (text.includes(UNKNOWN_MARKER)) {
      return { status: 'unknown', engine: ENGINE_NAME }
    }
    return { status: 'clean', engine: ENGINE_NAME }
  }

  /**
   * Reads at most `MAX_SCAN_BYTES` from the body as UTF-8 text. A `Buffer` is
   * sliced directly; a stream is drained chunk-by-chunk, and each chunk is
   * truncated to the remaining budget before it is retained, so buffered memory
   * stays capped at `MAX_SCAN_BYTES` even when the first chunk is very large.
   *
   * @param body - The upload body - a `Buffer` or a readable stream.
   * @returns The decoded leading prefix of the body.
   */
  private async readPrefix(body: Buffer | NodeJS.ReadableStream): Promise<string> {
    if (Buffer.isBuffer(body)) {
      return body.subarray(0, MAX_SCAN_BYTES).toString('utf8')
    }
    const chunks: Buffer[] = []
    let total = 0
    for await (const chunk of body as AsyncIterable<Buffer | string>) {
      const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
      const remaining = MAX_SCAN_BYTES - total
      const slice = buffer.length > remaining ? buffer.subarray(0, remaining) : buffer
      chunks.push(slice)
      total += slice.length
      if (total >= MAX_SCAN_BYTES) {
        break
      }
    }
    return Buffer.concat(chunks, total).toString('utf8')
  }
}

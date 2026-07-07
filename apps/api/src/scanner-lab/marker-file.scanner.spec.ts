/**
 * Unit: MarkerFileScanner - the deterministic, inert-marker demo scanner.
 *
 * Covers every verdict (infected / unknown / clean), both body kinds (Buffer
 * and stream), string vs Buffer stream chunks, the bounded-read break, and the
 * post-upload (no body) key convention. Uses ONLY inert `X-DEMO-*` markers.
 *
 * @module scanner-lab/marker-file.scanner.spec
 */
import { Readable } from 'node:stream'
import type { IFileScanner } from '@bymax-one/nest-storage'
import { MarkerFileScanner } from './marker-file.scanner.js'

/** Scan input accepted by the scanner. */
type ScanInput = Parameters<IFileScanner['scan']>[0]

/**
 * Builds a pre-upload scan input around a body, overridable per test.
 *
 * @param body - The body to scan.
 * @param overrides - Fields to override on the base input.
 * @returns A pre-upload scan input.
 */
function preUpload(
  body: NonNullable<ScanInput['body']>,
  overrides: Partial<ScanInput> = {},
): ScanInput {
  return {
    mode: 'pre-upload',
    body,
    key: 'vault/object.bin',
    bucket: 'vault',
    contentType: 'application/octet-stream',
    ...overrides,
  }
}

describe('MarkerFileScanner (unit)', () => {
  const scanner = new MarkerFileScanner()

  it('reports infected with a threat for a Buffer body carrying the infected marker', async () => {
    /*
     * Scenario: a pre-upload Buffer body contains X-DEMO-INFECTED.
     * Rule it protects: the infected verdict wins and carries the demo threat
     * name and engine (Buffer body path).
     */
    const result = await scanner.scan(preUpload(Buffer.from('start X-DEMO-INFECTED end')))
    expect(result).toEqual({ status: 'infected', engine: 'marker-demo', threat: 'Demo.Marker.A' })
  })

  it('reports unknown for a Buffer body carrying the unknown marker', async () => {
    /*
     * Scenario: a Buffer body contains X-DEMO-UNKNOWN (and no infected marker).
     * Rule it protects: the inconclusive verdict is returned without a threat.
     */
    const result = await scanner.scan(preUpload(Buffer.from('note X-DEMO-UNKNOWN note')))
    expect(result).toEqual({ status: 'unknown', engine: 'marker-demo' })
  })

  it('reports clean for a Buffer body with no markers', async () => {
    /*
     * Scenario: a benign Buffer body.
     * Rule it protects: the absence of both markers is clean.
     */
    const result = await scanner.scan(preUpload(Buffer.from('completely harmless content')))
    expect(result).toEqual({ status: 'clean', engine: 'marker-demo' })
  })

  it('reads Buffer chunks from a stream body', async () => {
    /*
     * Scenario: a readable stream yields Buffer chunks containing the marker.
     * Rule it protects: the stream branch drains Buffer chunks (the non-string
     * arm) and still finds the marker.
     */
    const stream = Readable.from([Buffer.from('X-DEMO-INFECTED payload')])
    const result = await scanner.scan(preUpload(stream))
    expect(result.status).toBe('infected')
  })

  it('reads string chunks from a stream body', async () => {
    /*
     * Scenario: a readable stream yields string chunks (objectMode).
     * Rule it protects: the string arm coerces chunks to Buffer before scanning.
     */
    const stream = Readable.from(['harmless string chunk'], { objectMode: true })
    const result = await scanner.scan(preUpload(stream))
    expect(result.status).toBe('clean')
  })

  it('stops reading a stream once the byte bound is reached', async () => {
    /*
     * Scenario: a stream longer than the 4096-byte scan bound, marker up front.
     * Rule it protects: the read breaks at the bound (never buffering the whole
     * body) yet still classifies from the prefix it captured.
     */
    const oversized = Buffer.from(`X-DEMO-INFECTED${'a'.repeat(5000)}`)
    const stream = Readable.from([oversized])
    const result = await scanner.scan(preUpload(stream))
    expect(result.status).toBe('infected')
  })

  it('scans the object key when no body is present (post-upload mode)', async () => {
    /*
     * Scenario: post-upload mode delivers only the key/bucket, no body.
     * Rule it protects: the body-absent branch falls back to the key convention,
     * keeping the verdict deterministic without downloading the object.
     */
    const result = await scanner.scan({
      mode: 'post-upload',
      key: 'vault/uploads/X-DEMO-INFECTED-token.bin',
      bucket: 'vault',
      contentType: 'application/octet-stream',
    })
    expect(result.status).toBe('infected')
  })
})

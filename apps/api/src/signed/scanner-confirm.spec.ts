/**
 * Unit: ScannerConfirm - the scanner-backed confirm-time scanner.
 *
 * Mocks `StorageService.download`/`delete` and drives a real `MarkerFileScanner`
 * over an in-memory stream. Covers the clean verdict (no delete), the unknown
 * verdict (no delete), the infected verdict (object deleted, threat surfaced),
 * an infected verdict without a threat name, and the bounded-range download.
 *
 * @module signed/scanner-confirm.spec
 */
import 'reflect-metadata'
import { Readable } from 'node:stream'
import { jest } from '@jest/globals'
import type { StorageService, ObjectMetadata } from '@bymax-one/nest-storage'
import { ScannerConfirm } from './scanner-confirm.js'
import { MarkerFileScanner } from '../scanner-lab/marker-file.scanner.js'

/** Minimal metadata stub for the downloaded object. */
function makeMetadata(): ObjectMetadata {
  return {
    key: 'storage-example/attachments/uuid',
    bucket: 'vault',
    size: 64,
    contentType: 'text/plain',
    etag: '"abc"',
    lastModified: new Date('2026-01-01'),
    metadata: {},
  }
}

/**
 * Builds the scanner with a mocked storage whose download yields `content`.
 *
 * @param content - The bytes the bounded download returns as a stream.
 * @returns The scanner and its mocked download/delete functions.
 */
function setup(content: string) {
  const download = jest.fn<StorageService['download']>().mockResolvedValue({
    stream: Readable.from([Buffer.from(content, 'utf8')]),
    metadata: makeMetadata(),
  })
  const del = jest.fn<StorageService['delete']>().mockResolvedValue(undefined)
  const storage = { download, delete: del } as unknown as StorageService
  const confirm = new ScannerConfirm(storage, new MarkerFileScanner())
  return { confirm, download, del }
}

describe('ScannerConfirm (unit)', () => {
  it('returns a clean verdict without deleting a clean object', async () => {
    /*
     * Scenario: the landed object carries no marker.
     * Rule it protects: a clean verdict is returned and the object is left in place.
     */
    const { confirm, del } = setup('an ordinary attachment body')
    await expect(confirm.scan('attachments/uuid', 'vault')).resolves.toEqual({ status: 'clean' })
    expect(del).not.toHaveBeenCalled()
  })

  it('returns an unknown verdict without deleting the object', async () => {
    /*
     * Scenario: the landed object carries the inert unknown marker.
     * Rule it protects: an unknown verdict is surfaced and the object is not removed
     * (rejection-on-unknown is the pipeline's concern, not confirm's).
     */
    const { confirm, del } = setup('body with X-DEMO-UNKNOWN token')
    await expect(confirm.scan('attachments/uuid', 'vault')).resolves.toEqual({ status: 'unknown' })
    expect(del).not.toHaveBeenCalled()
  })

  it('deletes the object and surfaces the threat on an infected verdict', async () => {
    /*
     * Scenario: the landed object carries the inert infected marker.
     * Rule it protects: confirm removes the object (real delete) and returns the
     * infected verdict with the threat name, so the threat cannot linger.
     */
    const { confirm, del } = setup('malware-ish X-DEMO-INFECTED body')
    await expect(confirm.scan('attachments/uuid', 'vault')).resolves.toEqual({
      status: 'infected',
      threat: 'Demo.Marker.A',
    })
    expect(del).toHaveBeenCalledWith('attachments/uuid', { bucket: 'vault' })
  })

  it('omits the threat field when an infected verdict carries no threat name', async () => {
    /*
     * Scenario: a scanner reports infected without a threat name.
     * Rule it protects: the verdict omits the optional threat field (rather than
     * emitting `threat: undefined`) while still removing the object.
     */
    const download = jest.fn<StorageService['download']>().mockResolvedValue({
      stream: Readable.from([Buffer.from('x', 'utf8')]),
      metadata: makeMetadata(),
    })
    const del = jest.fn<StorageService['delete']>().mockResolvedValue(undefined)
    const storage = { download, delete: del } as unknown as StorageService
    const scanner = {
      scan: jest.fn<MarkerFileScanner['scan']>().mockResolvedValue({
        status: 'infected',
        engine: 'marker-demo',
      }),
    } as unknown as MarkerFileScanner
    const confirm = new ScannerConfirm(storage, scanner)
    // toStrictEqual (not toEqual): the absent threat must be OMITTED, never rendered
    // as `threat: undefined`, so a mutant that always spreads the threat is caught.
    await expect(confirm.scan('attachments/uuid', 'vault')).resolves.toStrictEqual({
      status: 'infected',
    })
    expect(del).toHaveBeenCalledTimes(1)
  })

  it('downloads only a bounded prefix of the object', async () => {
    /*
     * Scenario: the confirm scan reads the landed object.
     * Rule it protects: a Range request bounds the read, so a large object is never
     * fully materialized to be scanned for a marker.
     */
    const { confirm, download } = setup('clean body')
    await confirm.scan('attachments/uuid', 'vault')
    const call = download.mock.calls[0]?.[0]
    expect(call?.range).toBe('bytes=0-4095')
    expect(call?.bucket).toBe('vault')
  })
})

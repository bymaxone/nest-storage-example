/**
 * Unit: copyBodySchema - Zod validation for the copy request body.
 *
 * Covers: valid same-bucket copy, valid archive copy, deleteSource flag,
 * destination enum rejection (invalid value), and missing required fields.
 *
 * @module vault/dto/copy.dto.spec
 */
import { copyBodySchema } from './copy.dto.js'

describe('copyBodySchema', () => {
  it('accepts a valid same-bucket copy body', () => {
    /*
     * Scenario: minimal valid copy within the same bucket.
     * Rule it protects: same-bucket copy with required fields parses correctly.
     */
    const result = copyBodySchema.parse({
      sourceKey: 'avatars/uuid.png',
      destinationKey: 'avatars/copy-uuid.png',
      destination: 'same',
    })
    expect(result.destination).toBe('same')
    expect(result.deleteSource).toBeUndefined()
  })

  it('accepts an archive-destination copy', () => {
    /*
     * Scenario: cross-bucket copy targeting vault-archive.
     * Rule it protects: 'archive' is a valid destination value.
     */
    const result = copyBodySchema.parse({
      sourceKey: 'docs/file.pdf',
      destinationKey: 'archive/file.pdf',
      destination: 'archive',
    })
    expect(result.destination).toBe('archive')
  })

  it('accepts deleteSource=true for the rename pattern', () => {
    /*
     * Scenario: caller opts into deleting the source after copy.
     * Rule it protects: deleteSource is accepted and passed through.
     */
    const result = copyBodySchema.parse({
      sourceKey: 'old/name.pdf',
      destinationKey: 'new/name.pdf',
      destination: 'same',
      deleteSource: true,
    })
    expect(result.deleteSource).toBe(true)
  })

  it('accepts deleteSource=false explicitly', () => {
    /*
     * Scenario: explicit false is valid (same as omitting).
     * Rule it protects: false is not treated as an invalid value.
     */
    const result = copyBodySchema.parse({
      sourceKey: 'a.pdf',
      destinationKey: 'b.pdf',
      destination: 'same',
      deleteSource: false,
    })
    expect(result.deleteSource).toBe(false)
  })

  it('rejects an invalid destination value', () => {
    /*
     * Scenario: destination='move' is not a valid enum member.
     * Rule it protects: only 'same' and 'archive' are accepted.
     */
    expect(() =>
      copyBodySchema.parse({
        sourceKey: 'a.png',
        destinationKey: 'b.png',
        destination: 'move',
      }),
    ).toThrow()
  })

  it('rejects an empty sourceKey', () => {
    /*
     * Scenario: sourceKey is an empty string; min(1) guard applies.
     * Rule it protects: empty keys are rejected before reaching the provider.
     */
    expect(() =>
      copyBodySchema.parse({
        sourceKey: '',
        destinationKey: 'dst.png',
        destination: 'same',
      }),
    ).toThrow()
  })

  it('rejects an empty destinationKey', () => {
    /*
     * Scenario: destinationKey is an empty string.
     * Rule it protects: destination key must be non-empty.
     */
    expect(() =>
      copyBodySchema.parse({
        sourceKey: 'src.png',
        destinationKey: '',
        destination: 'same',
      }),
    ).toThrow()
  })

  it('rejects a missing destination field', () => {
    /*
     * Scenario: destination is required and omitted.
     * Rule it protects: destination is not optional.
     */
    expect(() =>
      copyBodySchema.parse({
        sourceKey: 'src.png',
        destinationKey: 'dst.png',
      }),
    ).toThrow()
  })
})

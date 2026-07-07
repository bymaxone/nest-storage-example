/**
 * Unit: UploadSessionStore - bounded LRU in-memory progress session store.
 *
 * Covers: create + append + get happy path, null on unknown session, LRU
 * eviction when the cap is exceeded, and touch-on-hit order semantics.
 *
 * @module uploads/upload-session.store.spec
 */
import 'reflect-metadata'
import { UploadSessionStore } from './upload-session.store.js'

/**
 * Creates a fresh store for each test (clearMocks + restoreMocks in the Jest
 * config reset the module; constructing directly keeps the test isolated).
 *
 * @returns A new `UploadSessionStore` instance.
 */
function makeStore(): UploadSessionStore {
  return new UploadSessionStore()
}

describe('UploadSessionStore (unit)', () => {
  describe('create + get', () => {
    it('returns an empty snapshot list for a newly created session', () => {
      /*
       * Scenario: create a session and immediately read it.
       * Rule it protects: a fresh session has zero snapshots, not null.
       */
      const store = makeStore()
      store.create('s1')
      expect(store.get('s1')).toEqual([])
    })

    it('returns null for an unknown session id', () => {
      /*
       * Scenario: get() is called with an id that was never created.
       * Rule it protects: unknown sessions return null, not undefined or [].
       */
      const store = makeStore()
      expect(store.get('unknown')).toBeNull()
    })

    it('returns a defensive copy so caller mutation does not affect the store', () => {
      /*
       * Scenario: a caller mutates the array returned by get() (push + reverse).
       * Rule it protects: get() hands out a copy, so the store's internal state
       * is not aliased and a subsequent get() is unaffected.
       */
      const store = makeStore()
      store.create('copy-s')
      store.append('copy-s', { loaded: 100, total: 500, part: 1 })
      const first = store.get('copy-s')
      first?.push({ loaded: 999 })
      first?.reverse()
      const second = store.get('copy-s')
      expect(second).toEqual([{ loaded: 100, total: 500, part: 1 }])
      expect(second).not.toBe(first)
    })
  })

  describe('append', () => {
    it('accumulates snapshots in insertion order', () => {
      /*
       * Scenario: two onProgress events arrive in sequence.
       * Rule it protects: snapshots are ordered by append time.
       */
      const store = makeStore()
      store.create('s2')
      store.append('s2', { loaded: 100, total: 500, part: 1 })
      store.append('s2', { loaded: 200, total: 500, part: 2 })
      const snapshots = store.get('s2')
      expect(snapshots).toHaveLength(2)
      expect(snapshots?.[0]).toEqual({ loaded: 100, total: 500, part: 1 })
      expect(snapshots?.[1]).toEqual({ loaded: 200, total: 500, part: 2 })
    })

    it('silently no-ops when the target session was evicted', () => {
      /*
       * Scenario: append is called for an id no longer in the store.
       * Rule it protects: evicted sessions do not throw or re-create.
       */
      const store = makeStore()
      expect(() => store.append('never-created', { loaded: 1 })).not.toThrow()
    })
  })

  describe('LRU eviction', () => {
    it('evicts the oldest session when the cap of 100 is exceeded', () => {
      /*
       * Scenario: 101 sessions are created; the first one must be evicted.
       * Rule it protects: the store never exceeds the 100-session cap.
       */
      const store = makeStore()
      for (let i = 0; i < 100; i++) {
        store.create(`s-${i}`)
      }
      expect(store.size()).toBe(100)
      // Creating session 101 should evict session 0 (the oldest).
      store.create('s-100')
      expect(store.size()).toBe(100)
      expect(store.get('s-0')).toBeNull()
      expect(store.get('s-100')).toEqual([])
    })

    it('does not evict a touched session before an older untouched one', () => {
      /*
       * Scenario: sessions 0 and 1 created, then 0 is touched (append), then
       * 102 more sessions push it to the cap. Session 1 (oldest untouched)
       * should be evicted before session 0.
       * Rule it protects: the LRU touch-on-hit moves the entry to newest.
       */
      const store = makeStore()
      store.create('old-a')
      store.create('old-b')
      // Touch old-a (moves it to the newest position, making old-b the oldest).
      store.append('old-a', { loaded: 1 })
      // Fill to cap - 2 more sessions so old-b becomes the one to evict.
      for (let i = 0; i < 98; i++) {
        store.create(`fill-${i}`)
      }
      expect(store.size()).toBe(100)
      // Adding one more should evict old-b (oldest), not old-a (recently touched).
      store.create('new-trigger')
      expect(store.get('old-b')).toBeNull()
      expect(store.get('old-a')).not.toBeNull()
    })

    it('refreshes recency on get() so a polled idle session survives eviction', () => {
      /*
       * Scenario: sessions read-a and read-b created; read-a is polled via get()
       * (no append), then the store is filled to the cap and pushed one over.
       * Rule it protects: get() moves read-a to newest, so read-b (oldest
       * untouched) is evicted first while the actively-polled read-a survives.
       */
      const store = makeStore()
      store.create('read-a')
      store.create('read-b')
      // Poll read-a via get() only (no append): this must refresh its recency.
      expect(store.get('read-a')).toEqual([])
      // Fill to the cap so read-b becomes the oldest eviction candidate.
      for (let i = 0; i < 98; i++) {
        store.create(`fill-${i}`)
      }
      expect(store.size()).toBe(100)
      // One more creation evicts read-b (oldest), not read-a (recently polled).
      store.create('read-trigger')
      expect(store.get('read-b')).toBeNull()
      expect(store.get('read-a')).not.toBeNull()
    })
  })

  describe('size', () => {
    it('reports the number of active sessions', () => {
      /*
       * Scenario: create three sessions and verify the count.
       * Rule it protects: size() returns the exact session count.
       */
      const store = makeStore()
      store.create('a')
      store.create('b')
      store.create('c')
      expect(store.size()).toBe(3)
    })
  })
})

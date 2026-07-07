/**
 * @fileoverview In-memory, bounded upload-progress session store. Each session
 * records a sequence of progress snapshots emitted by the library's
 * `onProgress` callback. The store is LRU-evicted at a hard cap of 100
 * sessions so it never grows without bound. The cap is intentionally small:
 * this store is a short-lived UI affordance, not a durable log -- sessions are
 * created at the start of an upload and read only until the UI has finished
 * rendering the progress bar (spec §10.3).
 * @layer api/uploads
 */
import { Injectable } from '@nestjs/common'

/** A single progress snapshot appended by the `onProgress` callback. */
export interface ProgressSnapshot {
  /** Bytes transferred so far. */
  loaded: number
  /** Total bytes (absent for unknown-size streams). */
  total?: number
  /** Part number for multipart uploads (1-indexed). */
  part?: number
  /** Upload strategy resolved by the library: `'single'` or `'multipart'`. */
  strategy?: 'single' | 'multipart'
}

/** Internal session entry: a snapshot list plus LRU position tracking. */
interface SessionEntry {
  snapshots: ProgressSnapshot[]
}

/** Hard cap on the number of concurrent sessions (LRU eviction). */
const MAX_SESSIONS = 100

/**
 * Bounded LRU store for upload-progress sessions. Sessions are created at
 * upload start, written by `onProgress` callbacks, and read by the polling
 * endpoint. The Map preserves insertion order, which is the basis of the LRU:
 * a hit deletes-and-reinserts the entry and eviction removes the oldest.
 */
@Injectable()
export class UploadSessionStore {
  private readonly sessions = new Map<string, SessionEntry>()

  /**
   * Creates a new empty session, evicting the oldest when over the cap.
   *
   * @param id - The session identifier (a UUID from the upload handler).
   */
  create(id: string): void {
    this.sessions.set(id, { snapshots: [] })
    this.evictIfNeeded()
  }

  /**
   * Appends a snapshot to an existing session. Silently no-ops when the
   * session has already been evicted (upload may outlive the LRU window).
   *
   * @param id - The session identifier.
   * @param snapshot - The progress snapshot to append.
   */
  append(id: string, snapshot: ProgressSnapshot): void {
    const entry = this.sessions.get(id)
    if (entry === undefined) return
    entry.snapshots.push(snapshot)
    // Touch: delete + reinsert to move the entry to newest position.
    this.sessions.delete(id)
    this.sessions.set(id, entry)
  }

  /**
   * Returns the snapshot list for a session, or `null` when the session is
   * unknown (never created or already evicted).
   *
   * @param id - The session identifier.
   * @returns The snapshot array, or `null`.
   */
  get(id: string): ProgressSnapshot[] | null {
    const entry = this.sessions.get(id)
    return entry !== undefined ? entry.snapshots : null
  }

  /**
   * Evicts the oldest session(s) until the session count is at most `MAX_SESSIONS`.
   * Uses the Map's insertion-order iteration: the first key in `for...of` is the
   * oldest (least recently created or touched). The `break` exits after one
   * eviction per iteration; the outer `while` repeats until under the cap.
   */
  private evictIfNeeded(): void {
    while (this.sessions.size > MAX_SESSIONS) {
      for (const key of this.sessions.keys()) {
        this.sessions.delete(key)
        break
      }
    }
  }

  /** Returns the current number of active sessions (for testing). */
  size(): number {
    return this.sessions.size
  }
}

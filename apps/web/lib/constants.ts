/**
 * @fileoverview Shared UI constants for the storage dashboard.
 * @layer lib/constants
 */

/** Base URL for the NestJS API. Falls back to localhost in development. */
export const API_BASE_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

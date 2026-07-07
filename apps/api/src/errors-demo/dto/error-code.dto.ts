/**
 * @fileoverview Zod schema for the `:code` route parameter of the error explorer.
 * The accepted values are exactly the shipped `STORAGE_ERROR_CODES`, so an
 * unknown code is rejected with 400 before any trigger runs.
 * @layer api/errors-demo
 */
import { z } from 'zod'
import { STORAGE_ERROR_CODES } from '@bymax-one/nest-storage'
import type { StorageErrorCode } from '@bymax-one/nest-storage'

/** The shipped codes as a non-empty tuple for `z.enum`. */
const CODE_VALUES = Object.values(STORAGE_ERROR_CODES) as [StorageErrorCode, ...StorageErrorCode[]]

/** Route-param schema accepting only a known `STORAGE_ERROR_CODES` value. */
export const errorCodeParamSchema = z.enum(CODE_VALUES)

/** Parsed error-code param type. */
export type ErrorCodeParam = z.infer<typeof errorCodeParamSchema>

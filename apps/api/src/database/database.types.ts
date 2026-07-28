/**
 * Kysely's internal database shape.
 *
 * Tables are added here only when their migrations are introduced. This type
 * must never be exposed through the public HTTP contract.
 */
export type Database = Record<never, never>

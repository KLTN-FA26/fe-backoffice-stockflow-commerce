/**
 * Server-side app config — single source for env-derived flags.
 *
 * USE_MOCK is server-only (no NEXT_PUBLIC_ prefix): it is read once here, in
 * a Server Component (root layout), and threaded down to client components
 * via context (see `MockModeProvider`/`useIsMock` in `providers/app-providers.tsx`).
 * Client code must never read `process.env.USE_MOCK` directly.
 */

export const IS_MOCK = process.env.USE_MOCK === "true";

---
name: stockflow-fix-lint
description: Fix StockFlowCommerce lint and TypeScript errors without suppressions or unrelated refactors. Use when asked to fix lint, typecheck, ESLint, or TypeScript diagnostics.
---

# Fix lint and type errors

The user's explicit instructions take precedence over this workflow.

1. Run `pnpm run typecheck` and `pnpm run lint` before editing; capture the full diagnostic set.
2. Scope work to the requested path, or `src` when no path is given.
3. Group errors by root cause and fix the smallest coherent group at a time. Re-run the affected
   check after each group.
4. End with both `pnpm run typecheck` and `pnpm run lint` passing with zero warnings.

Use correct types or `unknown` plus narrowing/zod parsing. Do not use `any`, `@ts-ignore`,
`@ts-expect-error`, unjustified assertions, or lint suppression to hide a diagnostic. An
`eslint-disable` is acceptable only for a real technical exception with a local explanatory
comment and user-visible disclosure.

Do not opportunistically rename, restructure, or clean adjacent code. If a diagnostic requires a
meaningful architecture change outside the requested scope, stop and explain the tradeoff instead
of making that decision silently. Do not stash or reset user changes without explicit permission.

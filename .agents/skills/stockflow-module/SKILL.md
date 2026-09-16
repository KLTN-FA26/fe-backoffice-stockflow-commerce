---
name: stockflow-module
description: Refactor one StockFlowCommerce feature module to the production architecture and complete the nine-step module playbook. Use for requests to build or refactor a named StockFlow module; do not use for unrelated small fixes.
---

# Refactor a StockFlow module

The user's explicit instructions take precedence over this workflow.

Input: one feature name such as `purchase-order`, `receipt`, or `invoice`. If the module cannot
be inferred safely, ask for its name before changing code.

## Establish the source of truth

1. Read `src/_design/PRODUCTION-FRONTEND-RULES.md` §13, §14, and Appendix B.
2. Read the matching business module under `D:\FPTU\Capstone\docs\docs\`. Preserve its field
   names, status union strings, transition table, and every `BR-xx`; do not invent missing facts.
3. Read `src/lib/mock-data.ts` read-only to confirm current data shapes.
4. Read `.claude/rules/feature-architecture.md`, `api-conventions.md`, `testing.md`, and the
   applicable Mode A or Mode B rule completely.
5. Load `$zod-br-schema` when schemas or lifecycle tables are involved and `$status-badge` when
   statuses are wired into UI.

## Implement the playbook

Work in this order and verify each meaningful increment:

1. Add `features/<name>/schemas.ts`: DTO schemas for backend data and separate create/update
   input schemas. Cite each encoded BR in a nearby comment.
2. Add `lifecycle.ts` from the documented transition table and tests for all transitions and
   terminal states.
3. Add `api.ts`, `queries.ts`, and `mutations.ts`; route mock requests only through
   `lib/api/mock-adapter.ts`.
4. Move derivation/filter/format logic to `selectors.ts`, shared format utilities, and URL filter
   hooks. Keep route `page.tsx` at or below 60 lines when practical.
5. Gate actions through `allowedActions(status, role)` and shared action/reason components; test
   at least three roles.
6. Implement shaped loading, error UI, and distinct no-data versus no-filter-results states.
7. Put filter, search, sort, page, and shareable tabs in the URL. Keep personal column/density
   preferences in the established persisted page config/store.
8. Verify focus, aria, contrast, keyboard table navigation, dark mode, and reduced motion.
9. Run `pnpm run validate` and inspect the result against `components-preview.html`.

Do not edit `mock-data.ts`, `components/ui/*`, design specification files, field/status names, or
color tokens unless the user explicitly asks for that exact change. Mark unresolved business
facts as `// ASSUMPTION (open-question Xn)` and tell the user.

Finish with changed-file highlights and real validation output. One module should remain one
reviewable unit; do not expand into adjacent modules.

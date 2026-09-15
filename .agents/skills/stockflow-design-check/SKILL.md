---
name: stockflow-design-check
description: Perform a read-only StockFlow UI design-system audit for theme leakage, raw colors, status badges, density, typography, and accessibility. Use when asked for a design check or UI compliance review; do not edit code.
---

# Audit the StockFlow design system

The user's explicit instructions take precedence over this workflow. This skill is read-only.

Audit the requested path, or `src` when none is supplied. Read `.claude/rules/design-tokens.md`
and the applicable Mode A/Mode B rule before evaluating findings.

Check, in severity order:

1. Caramel tokens leaking into back-office or blue/ink CTA tokens leaking into storefront.
2. Raw six-digit hex colors outside `globals.css`/`lib/tokens.ts`; pink, magenta, fuchsia;
   `!important`; z-index values outside the project's fixed scale.
3. Status UI bypassing `<StatusBadge domain status>` or altering documented status strings.
4. Wrong density: back-office uses compact small-radius bordered surfaces; storefront uses airy
   larger-radius surfaces and may use subtle elevation.
5. Failure to reuse established shared components.
6. Missing `tabular-nums`/mono for numeric values and identifiers.
7. Missing loading/error/two empty states, focus-visible, aria, contrast, keyboard behavior,
   reduced motion, or token-based dark mode.

Use targeted `rg` searches plus contextual reads; a search hit is evidence to inspect, not an
automatic finding. Report `file:line — issue — required replacement`, ordered by severity.
Separate definite violations from aesthetic suggestions and do not invent findings to fill a list.

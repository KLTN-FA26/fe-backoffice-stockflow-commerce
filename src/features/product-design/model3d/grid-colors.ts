// Ported from stockflow-storefront src/features/product-design/components/model-check/grid-colors.ts
// (kept in docs/superpowers/patches/2026-11-13-glb-do-kiem.patch). Reads this repository's tokens.
import type { GridColors } from "./grid-texture";

/** The `globals.css` token each grid colour is read from; the painting itself is in `grid-texture.ts`. */
const GRID_TOKENS: Record<keyof GridColors, string> = {
  paper: "--bg-surface",
  minor: "--border-default",
  major: "--ink-tertiary",
  number: "--ink-primary",
  trim: "--accent",
  safe: "--positive",
  bleed: "--danger",
  top: "--accent",
  left: "--warning",
};

/** The grid's colours from the current theme; empty strings where nothing is styled (a test DOM). */
export function readGridColors(): GridColors {
  const style = typeof document === "undefined" ? null : getComputedStyle(document.documentElement);
  const read = (token: string) => style?.getPropertyValue(token).trim() ?? "";
  return {
    paper: read(GRID_TOKENS.paper),
    minor: read(GRID_TOKENS.minor),
    major: read(GRID_TOKENS.major),
    number: read(GRID_TOKENS.number),
    trim: read(GRID_TOKENS.trim),
    safe: read(GRID_TOKENS.safe),
    bleed: read(GRID_TOKENS.bleed),
    top: read(GRID_TOKENS.top),
    left: read(GRID_TOKENS.left),
  };
}

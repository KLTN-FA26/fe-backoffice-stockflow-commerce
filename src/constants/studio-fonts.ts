/**
 * The fonts the storefront design studio offers, by the code a print configuration's `allowedFontCodes` stores.
 * Copied by hand from the storefront's `src/app/(studio)/design/fonts.ts` (`STUDIO_FONTS`).
 *
 * ASSUMPTION: the BE has no font list API yet, so this list has to be kept in step with the storefront by hand. When
 * BE-18 (a font list endpoint) exists, replace this file with a query; a code stored here that the storefront does
 * not know is simply ignored by the studio.
 */
export const STUDIO_FONTS = [
  { code: "be-vietnam-pro", label: "Be Vietnam Pro" },
  { code: "montserrat", label: "Montserrat" },
  { code: "roboto-slab", label: "Roboto Slab" },
  { code: "playfair-display", label: "Playfair Display" },
  { code: "oswald", label: "Oswald" },
  { code: "dancing-script", label: "Dancing Script" },
  { code: "lobster", label: "Lobster" },
  { code: "pacifico", label: "Pacifico" },
] as const;

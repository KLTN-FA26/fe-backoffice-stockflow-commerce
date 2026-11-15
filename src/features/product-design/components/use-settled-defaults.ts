"use client";

import { useEffect, useState } from "react";

import { MODEL3D_VIEW } from "@/constants/numbers";

import type { PrintDefaultsValues } from "./print-defaults";

/** The figures the grid depends on (margins, seam, fold) are all numbers, not negative: a half-typed field is not. */
const usable = (d: PrintDefaultsValues) =>
  [d.safeMarginMm, d.bleedMm, d.seamMm, d.rimMm, d.topFoldMm].every(
    (n) => Number.isFinite(n) && n >= 0,
  );

/**
 * The defaults of the form once the person has stopped typing (and only when they are usable): the grid is painted
 * again from these, not on every keystroke. The same object is kept while the values do not change.
 */
export function useSettledDefaults(defaults: PrintDefaultsValues): PrintDefaultsValues {
  const [settled, setSettled] = useState(defaults);
  useEffect(() => {
    if (!usable(defaults)) return;
    const timer = setTimeout(
      () =>
        setSettled((current) =>
          JSON.stringify(current) === JSON.stringify(defaults) ? current : defaults,
        ),
      MODEL3D_VIEW.redrawDelayMs,
    );
    return () => clearTimeout(timer);
  }, [defaults]);
  return settled;
}

"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const read = () => document.documentElement.getAttribute("data-theme") ?? "";

/**
 * The theme the page shows now (`data-theme` of the root element). A canvas cannot read CSS variables, so the grid is
 * painted again when this changes. Reads the attribute itself, so it needs no provider.
 */
export function useThemeStamp(): string {
  return useSyncExternalStore(subscribe, read, () => "");
}

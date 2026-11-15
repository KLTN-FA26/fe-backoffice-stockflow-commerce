"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { buildPrintView, undoPrintView } from "./print-view";

import type { BuildPrintViewArgs, PrintView } from "./print-view";

/** Where the built view is kept for React to read: the view is a resource made and freed by an effect, not state. */
function createHolder() {
  let current: PrintView | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(next: PrintView | null) {
      current = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

/**
 * The grid meshes of the loaded model while `enabled`: built when it starts, and taken away (the file's own meshes
 * shown again, everything made freed) when the inputs change, `enabled` ends or the component unmounts. `stamp` is
 * the theme: a new one paints the grid again in the new colours.
 */
export function usePrintView({
  root,
  parts,
  template,
  model,
  enabled,
  stamp,
}: BuildPrintViewArgs & { enabled: boolean; stamp: string }): PrintView | null {
  const [holder] = useState(createHolder);
  useEffect(() => {
    if (!enabled) return;
    const built = buildPrintView({ root, parts, template, model });
    holder.set(built);
    return () => {
      undoPrintView(built);
      holder.set(null);
    };
  }, [holder, root, parts, template, model, enabled, stamp]);
  return useSyncExternalStore(holder.subscribe, holder.get, () => null);
}

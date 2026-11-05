import { useCallback, useRef } from "react";

import { normalizeLocation } from "./selectors";

import type { MoveCreateInput } from "./types";

// The same content always goes out under the same idempotency key (a retry after a lost response
// replays the move instead of making it twice); different content gets a fresh key, otherwise the
// server would answer an edited retry with the move that was already made.
function signature(input: MoveCreateInput): string {
  return [
    input.sku.trim().toUpperCase(),
    input.lotNumber?.trim() ?? "",
    normalizeLocation(input.fromLocation),
    normalizeLocation(input.toLocation),
    String(input.quantity),
  ].join("|");
}

export function useMoveRequestId() {
  const current = useRef<{ signature: string; id: string } | null>(null);
  const idFor = useCallback((input: MoveCreateInput) => {
    const next = signature(input);
    if (current.current?.signature !== next) {
      current.current = { signature: next, id: crypto.randomUUID() };
    }
    return current.current.id;
  }, []);
  const forget = useCallback(() => {
    current.current = null;
  }, []);
  return { idFor, forget };
}

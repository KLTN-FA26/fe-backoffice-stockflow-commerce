import { useCallback, useRef } from "react";

import { normalizeLocation, normalizeLpn } from "./selectors";

import type { MoveCreateInput } from "./types";

// The same content always goes out under the same idempotency key (a retry after a lost response replays the move
// instead of making it twice); different content gets a fresh key, otherwise the server refuses it with
// IDEMPOTENCY_KEY_REUSED. BE so sánh TẬP thùng + đích: đổi thứ tự quét không phải lệnh khác.
function signature(input: MoveCreateInput): string {
  const lpns = [...new Set(input.lpns.map(normalizeLpn))].sort();
  return `${lpns.join(",")}→${normalizeLocation(input.toLocation)}`;
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

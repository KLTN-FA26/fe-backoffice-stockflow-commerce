import { useMutation, useQueryClient } from "@tanstack/react-query";

import { MOVE_QUERY_KEYS } from "@/constants/move";

import { createMove } from "./api";

import type { MoveCreateInput } from "./types";

/** A move writes one ledger line and shifts stock between two rows: refresh both caches. */
export function useCreateMove() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, requestId }: { input: MoveCreateInput; requestId: string }) =>
      createMove(input, requestId),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: [MOVE_QUERY_KEYS.movements] }),
        client.invalidateQueries({ queryKey: [MOVE_QUERY_KEYS.stock] }),
      ]);
    },
  });
}

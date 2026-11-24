import { useMutation, useQueryClient } from "@tanstack/react-query";

import { MOVE_QUERY_KEYS } from "@/constants/move";

import { createMove } from "./api";

import type { MoveCreateInput } from "./types";

// Chuyển thùng ghi sổ kho (MOVE), đổi tồn theo vị trí, vị trí của thùng (danh sách thùng / cách ly) và tem LPN của bin
// trên bản đồ: làm mới các nhóm đó.
const REFRESHED = [
  MOVE_QUERY_KEYS.movements,
  MOVE_QUERY_KEYS.stock,
  MOVE_QUERY_KEYS.stockPackage,
  MOVE_QUERY_KEYS.warehouseMap,
  MOVE_QUERY_KEYS.binCartons,
] as const;

export function useCreateMove() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, requestId }: { input: MoveCreateInput; requestId: string }) =>
      createMove(input, requestId),
    onSuccess: async () => {
      await Promise.all(REFRESHED.map((key) => client.invalidateQueries({ queryKey: [key] })));
    },
  });
}

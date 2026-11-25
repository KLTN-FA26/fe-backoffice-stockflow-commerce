import { useMutation, useQueryClient } from "@tanstack/react-query";

import { MOVE_QUERY_KEYS } from "@/constants/move";

import { ApiError } from "@/lib/api/error";

import { createMove } from "./api";
import { moveKeys } from "./queries";

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

const DOES_NOT_FIT = "CARTON_DOES_NOT_FIT_BIN";

export function useCreateMove() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, requestId }: { input: MoveCreateInput; requestId: string }) =>
      createMove(input, requestId),
    onSuccess: async () => {
      await Promise.all(REFRESHED.map((key) => client.invalidateQueries({ queryKey: [key] })));
    },
    // Gợi ý không giữ chỗ (BE #412): bin vừa gợi ý có thể đã bị lấp → BE từ chối cả lệnh (docs 11 BR-10). Hỏi lại gợi ý
    // cho danh sách hiện tại.
    onError: async (error: unknown) => {
      if (error instanceof ApiError && error.code === DOES_NOT_FIT) {
        await client.invalidateQueries({ queryKey: moveKeys.binSuggestionsAll() });
      }
    },
  });
}

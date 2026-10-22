import {
  createPlanFingerprint,
  hasCreatePlanRequestId,
} from "@/features/load-planning/request-ids";

import type { CreatePlanInput } from "@/features/load-planning/plan-types";

/**
 * Lô gửi đi khi lập kế hoạch. Thường chỉ gửi các lô còn trong danh sách ứng viên (lô bị kế hoạch khác lấy mất thì bỏ,
 * không gửi id mồ côi). NGOẠI LỆ: đã có `requestId` nhớ cho đúng lựa chọn này nghĩa là một lần gửi trước mất phản hồi
 * — BE có thể đã tạo bản nháp và giữ các lô đó, nên chúng không còn trong ứng viên. Khi đó gửi nguyên lựa chọn để
 * `requestId` cũ được replay thay vì bị chặn ở bước kiểm tra và để lại bản nháp mồ côi giữ lô.
 */
export function shipmentIdsToSend(
  selected: readonly string[],
  known: ReadonlySet<string>,
  rest: Omit<CreatePlanInput, "requestId" | "shipmentIds">,
): string[] {
  const replay = hasCreatePlanRequestId(
    createPlanFingerprint({ ...rest, shipmentIds: [...selected] }),
  );
  return replay ? [...selected] : selected.filter((id) => known.has(id));
}

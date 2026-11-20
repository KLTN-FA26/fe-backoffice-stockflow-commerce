/**
 * Duyệt thiết kế — mutation + invalidation map (api-conventions §2.3).
 *
 * Sau khi quyết định, người duyệt mất quyền đọc thiết kế (APPROVED / DRAFT không còn "chờ duyệt", BE
 * `CustomerDesignRules.java:44-52` → 404). Vì vậy: bỏ chi tiết khỏi cache (`removeQueries`, không invalidate — invalidate sẽ
 * tải lại và nhận 404), tải lại hàng đợi và vòng duyệt, rồi về hàng đợi (hoặc vòng duyệt nếu đến từ đó).
 * Hết giờ / mất kết nối: BE có thể đã duyệt xong → không gửi lại, xử lý như đã rời trang và báo đã tải lại danh sách.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { ADMIN_ROUTES, DESIGN_REVIEW_LABELS } from "@/constants";

import { toast } from "@/components/shared/Toast";

import { decideDesign } from "./api";
import { DESIGN_STALE_CODES, isDesignErrorCode, isUncertainOutcome } from "./errors";
import { designKeys, roundKeys } from "./queries";

import type { ApiError } from "@/lib/api/error";
import type { DecideDesignInput } from "./api";
import type { Design } from "./types";

/** Đích sau khi quyết định: vòng duyệt `?round=` nếu đến từ đó, không thì hàng đợi. */
export function reviewReturnHref(roundId?: string | null): string {
  return roundId
    ? ADMIN_ROUTES.designReviewRounds.detail(roundId)
    : ADMIN_ROUTES.designs.reviewQueue;
}

export function useDecideDesign({ roundId }: { roundId?: string | null } = {}) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const leave = (id: string) => {
    queryClient.removeQueries({ queryKey: designKeys.detail(id) });
    void queryClient.invalidateQueries({ queryKey: designKeys.queue() });
    void queryClient.invalidateQueries({ queryKey: roundKeys.all });
    router.push(reviewReturnHref(roundId));
  };

  return useMutation<Design, ApiError, DecideDesignInput>({
    mutationFn: decideDesign,
    onSuccess: (_design, input) => {
      leave(input.id);
      // SKU riêng chưa đọc được ở BO (DesignDraftResponse không có customerSku — chờ BE-2).
      toast.success(input.approved ? DESIGN_REVIEW_LABELS.approved : DESIGN_REVIEW_LABELS.returned);
    },
    onError: (error, input) => {
      if (isUncertainOutcome(error)) {
        leave(input.id);
        toast.warning(DESIGN_REVIEW_LABELS.slowOutcome);
        return;
      }
      if (isDesignErrorCode(error, DESIGN_STALE_CODES)) {
        void queryClient.invalidateQueries({ queryKey: designKeys.detail(input.id) });
        void queryClient.invalidateQueries({ queryKey: designKeys.queue() });
      }
    },
  });
}

/**
 * Duyệt thiết kế — mutation + invalidation map (api-conventions §2.3).
 *
 * Sau khi quyết định, người duyệt mất quyền đọc thiết kế (APPROVED / DRAFT không còn "chờ duyệt", BE
 * `CustomerDesignRules.java:44-52` → 404). Vì vậy: bỏ mọi dữ liệu của thiết kế khỏi cache (`removeQueries`, không
 * invalidate — invalidate sẽ tải lại và nhận 404), tải lại hàng đợi và vòng duyệt, rồi về hàng đợi (hoặc vòng duyệt nếu
 * đến từ đó). Hết giờ / mất kết nối: BE có thể đã duyệt xong → không gửi lại, xử lý như đã quyết định.
 *
 * Cache được dọn ở mức hook (chạy cả khi người dùng đã rời trang); chuyển trang chỉ ở callback của lần `decide` — React
 * Query bỏ callback đó khi trang chi tiết đã unmount, nên người đã sang trang khác không bị kéo về hàng đợi.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { ADMIN_ROUTES, DESIGN_REVIEW_LABELS, DESIGN_ROUND_LABELS } from "@/constants";

import { toast } from "@/components/shared/Toast";

import { approveRound, decideDesign, listReviewQueue } from "./api";
import { DESIGN_STALE_CODES, isDesignErrorCode, isUncertainOutcome } from "./errors";
import { designKeys, roundKeys } from "./queries";

import type { ApiError } from "@/lib/api/error";
import type { ApproveRoundInput, DecideDesignInput } from "./api";
import type { Design, RoundApproval } from "./types";

/** Hai dòng đầu của hàng đợi là đủ để tìm thiết kế kế tiếp (dòng đầu có thể là thiết kế vừa quyết định). */
const NEXT_PAGE = { page: 0, size: 2 };

/** Đích sau khi quyết định: vòng duyệt `?round=` nếu đến từ đó, không thì hàng đợi. */
export function reviewReturnHref(roundId?: string | null): string {
  return roundId
    ? ADMIN_ROUTES.designReviewRounds.detail(roundId)
    : ADMIN_ROUTES.designs.reviewQueue;
}

export function useDecideDesign({ roundId }: { roundId?: string | null } = {}) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const forget = (id: string) => {
    queryClient.removeQueries({ queryKey: designKeys.design(id) });
    void queryClient.invalidateQueries({ queryKey: designKeys.queue() });
    void queryClient.invalidateQueries({ queryKey: roundKeys.all });
  };

  const mutation = useMutation<Design, ApiError, DecideDesignInput>({
    mutationFn: decideDesign,
    onSuccess: (design, input) => {
      forget(input.id);
      if (!input.approved) toast.success(DESIGN_REVIEW_LABELS.returned);
      else
        toast.success(
          design.customerSku
            ? `${DESIGN_REVIEW_LABELS.approvedWithSku} ${design.customerSku}`
            : DESIGN_REVIEW_LABELS.approved,
        );
    },
    onError: (error, input) => {
      if (isUncertainOutcome(error)) {
        forget(input.id);
        toast.warning(DESIGN_REVIEW_LABELS.slowOutcome);
        return;
      }
      // Dữ liệu đã cũ: tải lại MỌI dữ liệu của thiết kế (file, lịch sử…), không chỉ chi tiết.
      if (isDesignErrorCode(error, DESIGN_STALE_CODES)) {
        void queryClient.invalidateQueries({ queryKey: designKeys.design(input.id) });
        void queryClient.invalidateQueries({ queryKey: designKeys.queue() });
      }
    },
  });

  /**
   * Thiết kế kế tiếp của hàng đợi (BO-UX-9), đọc mới sau khi quyết định; không còn thì về hàng đợi. Lỗi đọc → về hàng
   * đợi như cũ, không chặn gì.
   */
  const nextHref = async (decidedId: string) => {
    try {
      const page = await queryClient.fetchQuery({
        queryKey: designKeys.queue(NEXT_PAGE),
        queryFn: ({ signal }) => listReviewQueue(NEXT_PAGE, signal),
        staleTime: 0,
      });
      const next = page.items.find((design) => design.id !== decidedId);
      return next ? ADMIN_ROUTES.designs.detail(next.id) : reviewReturnHref(roundId);
    } catch {
      return reviewReturnHref(roundId);
    }
  };

  /** Gửi quyết định; về hàng đợi / vòng duyệt (hoặc thiết kế kế tiếp) chỉ khi trang chi tiết còn mở. */
  const decide = (
    input: DecideDesignInput,
    options: { onError?: (error: ApiError) => void; openNext?: boolean } = {},
  ) =>
    mutation.mutate(input, {
      onSuccess: () => {
        if (options.openNext) void nextHref(input.id).then((href) => router.push(href));
        else router.push(reviewReturnHref(roundId));
      },
      onError: (error) => {
        if (isUncertainOutcome(error)) router.push(reviewReturnHref(roundId));
        else options.onError?.(error);
      },
    });

  // Đến từ vòng duyệt thì về vòng duyệt; "thiết kế tiếp theo" chỉ có nghĩa với hàng đợi.
  return { ...mutation, decide, fromQueue: !roundId };
}

export type DecideDesignMutation = ReturnType<typeof useDecideDesign>;

/**
 * "Duyệt tất cả": cache chi tiết vòng được ghi bằng `round` trong response (không tải lại). Thiết kế đã duyệt thì người
 * duyệt mất quyền đọc (404) → bỏ dữ liệu của chúng khỏi cache; hàng đợi và danh sách vòng được tải lại. Hết giờ / mất kết
 * nối: BE có thể đã duyệt xong → không gửi lại, tải lại vòng để thấy kết quả thật.
 */
export function useApproveRound(roundId: string) {
  const queryClient = useQueryClient();
  return useMutation<RoundApproval, ApiError, ApproveRoundInput>({
    mutationFn: approveRound,
    onSuccess: (result) => {
      queryClient.setQueryData(roundKeys.detail(roundId), result.round);
      for (const { designId, outcome } of result.outcomes) {
        if (outcome === "APPROVED")
          queryClient.removeQueries({ queryKey: designKeys.design(designId) });
      }
      void queryClient.invalidateQueries({ queryKey: roundKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: designKeys.queue() });
    },
    onError: (error) => {
      if (isUncertainOutcome(error)) {
        void queryClient.invalidateQueries({ queryKey: roundKeys.all });
        void queryClient.invalidateQueries({ queryKey: designKeys.queue() });
        toast.warning(DESIGN_ROUND_LABELS.slowOutcome);
      }
    },
  });
}

/**
 * Purchase Order — mutation hooks.
 *
 * Uses createMutation / createTransitionMutation factories.
 */

import { createMutation, createTransitionMutation } from "@/lib/api/query-factory";
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  transitionPurchaseOrder,
  type CreatePoInput,
  type CreatePoResult,
  type TransitionPoInput,
} from "./api";
import { poKeys, replenishmentKeys } from "./queries";
import type { PurchaseOrder } from "./types";

/* ── Create ──────────────────────────────────────────────────────────── */

export const useCreatePo = createMutation<CreatePoInput, CreatePoResult>(createPurchaseOrder, {
  invalidate: [poKeys.all],
  successMessage: "Tạo đơn đặt hàng thành công",
});

/* ── Update ──────────────────────────────────────────────────────────── */

export const useUpdatePo = createMutation<{ id: string } & Partial<CreatePoInput>, PurchaseOrder>(
  updatePurchaseOrder,
  {
    invalidate: [poKeys.all],
    successMessage: "Cập nhật đơn đặt hàng thành công",
  },
);

/* ── Status transition ───────────────────────────────────────────────── */

export const useTransitionPo = createTransitionMutation<TransitionPoInput, PurchaseOrder>(
  transitionPurchaseOrder,
  poKeys,
  [replenishmentKeys.all], // cross-module invalidation
  "Chuyển trạng thái thành công",
);

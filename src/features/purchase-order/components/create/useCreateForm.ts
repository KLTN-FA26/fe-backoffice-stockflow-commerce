"use client";

import { useRouter } from "next/navigation";

import { ADMIN_ROUTES, TOAST_MESSAGES } from "@/constants";
import { createPoSchema, useCreatePo } from "@/features/purchase-order";
import { toast } from "@/components/shared/Toast";

import { toCreateInput } from "./create-payload";
import { PO_CREATE_DEFAULTS } from "./types";
import { usePoWizard } from "./usePoWizard";

import type { PoWizard } from "./usePoWizard";

const MSG = TOAST_MESSAGES.purchaseOrder;

export type CreatePoWizard = PoWizard;

/** Màn tạo PO: lõi wizard dùng chung + mutation tạo, điều hướng sang chi tiết sau khi tạo. */
export function useCreateForm(): PoWizard {
  const router = useRouter();
  const createPo = useCreatePo();

  return usePoWizard({
    mode: "create",
    defaults: PO_CREATE_DEFAULTS,
    isSubmitting: createPo.isPending,
    onConfirm: (v, applyServerErrors, closeConfirm) => {
      // Payload BE = chốt chặn cuối (cùng ràng buộc CreatePurchaseOrderRequest).
      const parsed = createPoSchema.safeParse(toCreateInput(v));
      if (!parsed.success) {
        closeConfirm();
        toast.error(TOAST_MESSAGES.form.checkForm, parsed.error.issues[0]?.message ?? "");
        return;
      }
      createPo.mutate(parsed.data, {
        onSuccess: (created) => {
          closeConfirm();
          if (created.possibleDuplicate) toast.warning(MSG.possibleDuplicate, created.poNumber);
          else toast.success(MSG.created, created.poNumber);
          const query = created.possibleDuplicate ? "?duplicate=1" : "";
          router.push(`${ADMIN_ROUTES.purchaseOrders.detail(created.poId)}${query}`);
        },
        onError: (err) => {
          closeConfirm();
          applyServerErrors(err);
        },
      });
    },
  });
}

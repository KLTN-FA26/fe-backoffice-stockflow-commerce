"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { ADMIN_ROUTES, SUPPLIER_ITEM_PERMISSIONS, TOAST_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { usePermissionChecker } from "@/lib/auth";
import {
  poErrorMessage,
  poKeys,
  poToFormValues,
  termsOf,
  updatePoSchema,
  useUpdateDraftPo,
} from "@/features/purchase-order";
import { toast } from "@/components/shared/Toast";

import { toUpdateInput } from "./create-payload";
import { usePoWizard } from "./usePoWizard";

import type { SkuSupplierRef } from "@/lib/references/sku-suppliers";
import type { SupplierCatalog } from "@/lib/references/supplier-items";
import type { PurchaseOrder } from "@/features/purchase-order";
import type { PoReload } from "./types";
import type { PoWizard } from "./usePoWizard";

const MSG = TOAST_MESSAGES.purchaseOrder;

/** GET chi tiết PO trả 403 (ngoài phạm vi kho) / 404 (không còn) — đơn không sửa tiếp được. */
function isGoneOrForbidden(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 403 || error.status === 404);
}

/**
 * Màn sửa PO nháp (BE SCRUM-462): lõi wizard dùng chung + `PUT /purchase-orders/{id}`.
 * `reload` tải lại PO — dùng khi BE báo 409 `OPTIMISTIC_LOCK` / 403 `OUT_OF_DATA_SCOPE`.
 */
export function useEditDraftForm(
  po: PurchaseOrder,
  catalog: SupplierCatalog | undefined,
  extraTerms: ReadonlyMap<string, SkuSupplierRef>,
  reload: PoReload,
  blocked = false,
): PoWizard {
  const router = useRouter();
  const can = usePermissionChecker();
  const queryClient = useQueryClient();
  const updateDraft = useUpdateDraftPo();
  // Đang tải lại PO sau 403 để phân loại — khoá nút lưu (chặn PUT thứ hai) tới khi xong.
  const [resolving, setResolving] = useState(false);
  // Giá trị mặc định tính MỘT lần lúc mở form — PO tải lại sau đó không ghi đè dữ liệu đang nhập.
  // `extraTerms`: điều khoản tra theo SKU cho dòng ngoài trang danh mục đã tải (danh mục > 200 dòng).
  const [defaults] = useState(() =>
    poToFormValues(po, catalog, new Map([...extraTerms].map(([sku, row]) => [sku, termsOf(row)]))),
  );
  // Version của bản nháp đang sửa. Không tự lấy theo PO tải lại nền (focus cửa sổ…): như vậy sẽ
  // ghi đè thay đổi của người khác mà không báo. Chỉ nhận version mới sau khi đã báo OPTIMISTIC_LOCK.
  const [version, setVersion] = useState(po.version);
  const detailHref = ADMIN_ROUTES.purchaseOrders.detail(po.poId);

  /** Không sửa tiếp được: báo lỗi rồi về màn chi tiết. */
  const leaveToDetail = (err: unknown) => {
    toast.error(MSG.actionFailed, poErrorMessage(err));
    // Chi tiết đang cache bản DRAFT (staleTime) → đánh dấu cũ để màn chi tiết tải lại trạng thái
    // mới, không hiện lại nút "Sửa nháp" (vòng sửa → bị từ chối).
    void queryClient.invalidateQueries({ queryKey: poKeys.detail(po.poId) });
    router.push(detailHref);
  };

  /**
   * Tải lại PO sau lỗi lưu, khoá nút lưu tới khi xong (chặn PUT thứ hai). Tải lại 403/404 ⇒ đơn ngoài
   * phạm vi / không còn → về chi tiết, báo theo lỗi tải lại; lỗi khác (mạng, 5xx) ⇒ giữ form + báo;
   * thành công ⇒ `onFresh`. Mọi nhánh giữ nguyên dữ liệu người dùng đang nhập trừ khi rời màn.
   */
  const withReload = async (onFresh: (fresh: PurchaseOrder) => void) => {
    setResolving(true);
    try {
      const { po: fresh, error } = await reload();
      if (error !== undefined) {
        if (isGoneOrForbidden(error)) leaveToDetail(error);
        else toast.error(MSG.actionFailed, MSG.draftReloadFailed);
      } else if (fresh) onFresh(fresh);
    } finally {
      setResolving(false);
    }
  };

  /** 409 `OPTIMISTIC_LOCK`: nhận version mới, giữ dữ liệu đang nhập. */
  const handleConflict = () =>
    withReload((fresh) => {
      toast.error(MSG.actionFailed, MSG.draftConflict);
      setVersion(fresh.version);
      // Người khác đã xoá dòng đó: `lineId` cũ gửi lên = BE 400 ("not a line of …") mọi lần lưu —
      // giữ dữ liệu người dùng nhưng coi dòng đó là dòng mới (BE `PurchaseOrder#reviseDraft`).
      const freshIds = new Set(fresh.lines.map((l) => l.lineId));
      wizard.form.getValues("lines").forEach((line, i) => {
        if (line.lineId !== "" && !freshIds.has(line.lineId)) {
          wizard.form.setValue(`lines.${i}.lineId`, "", { shouldDirty: true });
        }
      });
    });

  /**
   * 403 `OUT_OF_DATA_SCOPE`: BE `reviseDraft` → `loadForUpdate` kiểm phạm vi kho CŨ của PO trước kho
   * mới chọn; GET cũng kiểm phạm vi kho của đơn. Tải lại được ⇒ đơn vẫn trong phạm vi: đã đổi kho thì
   * lỗi là của kho mới chọn (báo ở ô), giữ kho cũ thì phạm vi vừa được trả lại → nhắc lưu lại.
   */
  const handleOutOfScope = (
    err: ApiError,
    chosenWarehouseId: string,
    applyServerErrors: (e: ApiError) => void,
  ) =>
    withReload((fresh) => {
      if (fresh.warehouseId === chosenWarehouseId)
        toast.error(MSG.actionFailed, MSG.draftRetrySave);
      else applyServerErrors(err);
    });

  const wizard = usePoWizard({
    mode: "edit",
    defaults,
    minExpectedDate: po.orderDate,
    currentWarehouse: { warehouseId: po.warehouseId, name: po.warehouseName ?? po.warehouseId },
    // UI-only — Backend phải re-check (@RequiresPermission procurement-supplier-items:READ)
    savedLinesWithoutTerms: !can(SUPPLIER_ITEM_PERMISSIONS.read),
    isSubmitting: updateDraft.isPending || resolving,
    blocked,
    onConfirm: (v, applyServerErrors, closeConfirm) => {
      // `updatePoSchema` = chốt chặn cuối: dòng đã lưu phải còn `unitPrice` (issue #30 §2).
      const parsed = updatePoSchema.safeParse(toUpdateInput(v, version));
      if (!parsed.success) {
        closeConfirm();
        toast.error(TOAST_MESSAGES.form.checkForm, parsed.error.issues[0]?.message ?? "");
        return;
      }
      updateDraft.mutate(
        { id: po.poId, body: parsed.data },
        {
          onSuccess: (saved) => {
            closeConfirm();
            // Toast "Đã lưu đơn nháp" do factory phát; chỉ thêm cảnh báo trùng như màn tạo.
            if (saved.possibleDuplicate) toast.warning(MSG.possibleDuplicate, saved.poNumber);
            router.push(`${detailHref}${saved.possibleDuplicate ? "?duplicate=1" : ""}`);
          },
          onError: (err) => {
            closeConfirm();
            if (err.code === "OPTIMISTIC_LOCK") void handleConflict();
            else if (err.code === "PURCHASE_ORDER_NOT_EDITABLE") leaveToDetail(err);
            else if (err.code === "OUT_OF_DATA_SCOPE")
              void handleOutOfScope(err, v.warehouseId, applyServerErrors);
            else applyServerErrors(err);
          },
        },
      );
    },
  });
  return wizard;
}

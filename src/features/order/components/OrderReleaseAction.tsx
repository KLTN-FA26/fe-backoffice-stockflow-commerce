"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useState } from "react";

import { ApiError } from "@/lib/api/error";
import { useWarehouseOptions } from "@/lib/references/warehouse-options";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { releaseOrderSchema } from "../action-schemas";
import { releaseErrorView } from "../errors";
import { useReleaseOrder } from "../mutations";
import { orderKeys } from "../queries";
import { customLineCount } from "../selectors";

import { OrderRefusalAlert } from "./OrderRefusalAlert";

import type { OrderErrorView } from "../errors";
import type { Order } from "../types";

/** Đơn đã đổi trạng thái / không còn trong phạm vi → đóng dialog, tải lại để nút tự ẩn. */
const STALE_ERROR_CODES: readonly string[] = ["CONFLICT", "NOT_FOUND"];

type ReleaseOrder = Pick<Order, "orderId" | "orderNumber" | "lines">;

/**
 * Release đơn (SCRUM-423, docs 17 §4.2 bước 4–6): Order Coordinator chọn kho xuất. Có dòng in →
 * sinh lệnh sản xuất, đơn In Production; chỉ hàng sẵn → Ready to Fulfill. Lý do từ chối của BE
 * (BR-PRD-08 mẫu chưa duyệt, BR-PRD-09 chưa đủ cọc, công nợ quá hạn…) hiện ngay trong dialog.
 */
export function OrderReleaseAction({ order }: { order: ReleaseOrder }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="sm"
        className="w-full rounded-[var(--r-sm)]"
        onClick={() => setOpen(true)}
      >
        <Send className="size-3.5" /> Release đơn
      </Button>
      <FormDialog open={open} onOpenChange={setOpen}>
        <ReleaseForm order={order} onClose={() => setOpen(false)} />
      </FormDialog>
    </>
  );
}

function ReleaseForm({ order, onClose }: { order: ReleaseOrder; onClose: () => void }) {
  const queryClient = useQueryClient();
  const warehouses = useWarehouseOptions();
  const [warehouseId, setWarehouseId] = useState("");
  const [refusal, setRefusal] = useState<OrderErrorView | null>(null);
  const { mutate: release, isPending } = useReleaseOrder();
  const parsed = releaseOrderSchema.safeParse({ warehouseId });
  const printLines = customLineCount(order);
  const warehousesForbidden =
    warehouses.error instanceof ApiError && warehouses.error.status === 403;

  const submit = () => {
    if (!parsed.success) return;
    setRefusal(null);
    release(
      { id: order.orderId, ...parsed.data },
      {
        onSuccess: onClose,
        onError: (error) => {
          const view = releaseErrorView(error);
          if (STALE_ERROR_CODES.includes(error.code)) {
            onClose();
            toast.error(view.title, view.detail);
            void queryClient.invalidateQueries({ queryKey: orderKeys.all });
            return;
          }
          setRefusal(view);
        },
      },
    );
  };

  return (
    <FormDialogBody
      title="Release đơn cho kho"
      description={`Chọn kho xuất cho đơn ${order.orderNumber}. ${
        printLines > 0
          ? `Đơn có ${printLines} dòng in — mỗi dòng sinh một lệnh sản xuất tại kho đã chọn.`
          : "Đơn chỉ gồm hàng sẵn — chuyển sang Sẵn sàng thực hiện."
      }`}
      submitLabel="Release"
      canSubmit={parsed.success}
      isPending={isPending}
      error={null}
      onSubmit={submit}
      onCancel={onClose}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="release-warehouse" className="text-ink-secondary text-xs font-medium">
          Kho xuất <span className="text-danger">*</span>
        </Label>
        <Select value={warehouseId} onValueChange={setWarehouseId} disabled={!warehouses.data}>
          <SelectTrigger id="release-warehouse" autoFocus className="w-full">
            <SelectValue placeholder={warehouses.isPending ? "Đang tải kho…" : "Chọn kho xuất"} />
          </SelectTrigger>
          <SelectContent>
            {warehouses.data?.map((w) => (
              <SelectItem key={w.warehouseId} value={w.warehouseId}>
                {w.code ? `${w.code} — ${w.name}` : w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {warehouses.isError && (
          <p className="text-danger text-xs">
            {warehousesForbidden
              ? "Tài khoản chưa được cấp quyền xem danh sách kho (warehouse-warehouses:READ) — liên hệ quản trị."
              : "Không tải được danh sách kho."}
          </p>
        )}
        {warehouses.data?.length === 0 && (
          <p className="text-ink-tertiary text-xs">Chưa có kho nào đang hoạt động.</p>
        )}
        {printLines > 0 && (
          // docs 17 §4.2 bước 4: dòng in chỉ giao cho kho có khu PRODUCTION + trạm in Active
          <p className="text-ink-tertiary text-xs">
            Dòng in chỉ release được cho kho có xưởng in. Thiết kế mới cần mẫu được khách duyệt
            (BR-PRD-08) — máy chủ kiểm khi release.
          </p>
        )}
      </div>
      {refusal && <OrderRefusalAlert view={refusal} />}
    </FormDialogBody>
  );
}

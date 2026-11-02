"use client";

import { useState } from "react";

import { usePermissionChecker } from "@/lib/auth/components/Can";
import { productionErrorMessage } from "@/features/production-order/errors";
import { allowedProductionActions } from "@/features/production-order/lifecycle";
import {
  useDispatchSubcontract,
  useResumeProduction,
  useStartPrinting,
} from "@/features/production-order/mutations";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { OutputDialog } from "./OutputDialog";
import { SplitDialog } from "./SplitDialog";
import { StatusDialog } from "./StatusDialogs";

import type { ProductionAction } from "@/features/production-order/lifecycle";
import type { ProductionDetail } from "@/features/production-order/types";
import type { StatusDialogKind } from "./StatusDialogs";

const LABEL: Partial<Record<ProductionAction, string>> = {
  prepress: "Kiểm tra prepress",
  startPrinting: "Bắt đầu in",
  output: "Ghi sản lượng",
  hold: "Tạm dừng",
  resume: "Chạy tiếp",
  cancel: "Huỷ lệnh",
  stop: "Dừng lệnh",
  split: "Tách gia công",
  dispatch: "Gửi gia công",
};
/** Nút chính (tô đậm, đặt cuối) theo bước kế tiếp của dây chuyền — giả định tần suất thao tác. */
const PRIMARY: readonly ProductionAction[] = [
  "prepress",
  "startPrinting",
  "output",
  "dispatch",
  "resume",
];
const DANGER: readonly ProductionAction[] = ["cancel", "stop"];

/**
 * Thanh thao tác LSX — chỉ hiện bước bảng vòng đời cho phép (lifecycle.ts). Xuất phôi và QC nằm
 * ngay trong panel tương ứng của trang (thao tác tại chỗ, có ô quét / nhập số).
 */
export function ProductionActions({ order }: { order: ProductionDetail }) {
  const can = usePermissionChecker();
  const [dialog, setDialog] = useState<ProductionAction | null>(null);
  const start = useStartPrinting();
  const resume = useResumeProduction();
  const dispatch = useDispatchSubcontract();
  const actions = allowedProductionActions(order, can).filter((action) => LABEL[action]);
  const close = () => setDialog(null);
  const onError = (error: unknown) => toast.error(productionErrorMessage(error));
  const statusKind: StatusDialogKind | null =
    dialog === "prepress" || dialog === "hold" || dialog === "cancel" || dialog === "stop"
      ? dialog
      : null;
  const ordered = [
    ...actions.filter((a) => !PRIMARY.includes(a)),
    ...actions.filter((a) => PRIMARY.includes(a)),
  ];
  const id = order.summary.id;

  return (
    <>
      {ordered.map((action) => (
        <Button
          key={action}
          size="sm"
          variant={PRIMARY.includes(action) ? "default" : "outline"}
          className={DANGER.includes(action) ? "text-danger" : undefined}
          onClick={() => setDialog(action)}
        >
          {LABEL[action]}
        </Button>
      ))}
      <StatusDialog kind={statusKind} order={order} onClose={close} />
      <OutputDialog
        order={order}
        open={dialog === "output"}
        onOpenChange={(open) => !open && close()}
      />
      <SplitDialog
        order={order}
        open={dialog === "split"}
        onOpenChange={(open) => !open && close()}
      />
      <ConfirmDialog
        open={dialog === "startPrinting"}
        onOpenChange={(open) => !open && close()}
        title="Bắt đầu in?"
        description="Lệnh chuyển sang Đang in. Ghi sản lượng và phế phẩm sau mỗi lượt in."
        confirmLabel="Bắt đầu in"
        variant="default"
        loading={start.isPending}
        closeOnConfirm={false}
        onConfirm={() => start.mutate(id, { onSuccess: close, onError })}
      />
      <ConfirmDialog
        open={dialog === "resume"}
        onOpenChange={(open) => !open && close()}
        title="Cho lệnh chạy tiếp?"
        description="Lệnh quay về đúng bước trước khi tạm dừng."
        confirmLabel="Chạy tiếp"
        variant="default"
        loading={resume.isPending}
        closeOnConfirm={false}
        onConfirm={() => resume.mutate(id, { onSuccess: close, onError })}
      />
      <ConfirmDialog
        open={dialog === "dispatch"}
        onOpenChange={(open) => !open && close()}
        title="Gửi cho nhà gia công?"
        description="Chỉ gửi được khi đơn đặt gia công đã duyệt và đủ số lượng. Hình thức gửi phôi: phôi chuyển sang vị trí của nhà gia công."
        confirmLabel="Gửi gia công"
        variant="default"
        loading={dispatch.isPending}
        closeOnConfirm={false}
        onConfirm={() => dispatch.mutate(id, { onSuccess: close, onError })}
      />
    </>
  );
}

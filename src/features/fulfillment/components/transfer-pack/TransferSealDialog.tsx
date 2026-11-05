"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { kitReasonSchema } from "@/features/fulfillment/transfer-pack-input-schemas";
import { transferPackErrorMessage } from "@/features/fulfillment/transfer-pack-errors";
import { useSealTransferPackage } from "@/features/fulfillment/transfer-pack-mutations";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FieldError } from "../primitives";
import { SealFormDialog } from "../packing/SealFormDialog";

import type { ReactNode } from "react";
import type { SealMeasures } from "../packing/SealFormDialog";
import type { TransferParcel } from "@/features/fulfillment/transfer-pack-types";

const L = UI_LABELS.transferPack;

/**
 * Cân, đo, niêm phong một kiện của lệnh chuyển kho (docs 08 bước 5–7, BR-03) — form của trạm đóng gói đơn
 * (`SealFormDialog`). Kiện nguyên thùng (LP2-8) điền sẵn số đo gợi ý theo đơn vị đóng gói; kiện thường chứa hàng đi nhiều
 * thùng (KIT-FORCE) phải nêu lý do (BE 422 `KIT_OVERRIDE_REASON_REQUIRED`).
 */
export function TransferSealDialog({
  packId,
  pkg,
  initial,
  hint,
  askKitReason,
  onClose,
}: {
  packId: string;
  pkg: TransferParcel;
  initial?: SealMeasures;
  hint?: ReactNode;
  /** Kiện chứa hàng nên đóng bộ mà đóng kiện thường: hỏi lý do. */
  askKitReason: boolean;
  onClose: () => void;
}) {
  const seal = useSealTransferPackage();
  const [reason, setReason] = useState(pkg.kitOverrideReason ?? "");
  const reasonCheck = kitReasonSchema.safeParse(reason);

  return (
    <SealFormDialog
      packageNo={pkg.packageNo}
      packageType={pkg.packageType}
      initial={initial}
      pending={seal.isPending}
      onClose={onClose}
      hint={
        <>
          {hint}
          {askKitReason && (
            <div>
              <Label htmlFor="transfer-seal-kit-reason" className="text-[0.8125rem]">
                {L.packages.kitReason}
              </Label>
              <Textarea
                id="transfer-seal-kit-reason"
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <FieldError>
                {reasonCheck.success ? undefined : reasonCheck.error.issues[0]?.message}
              </FieldError>
            </div>
          )}
        </>
      }
      onSeal={(values, fail) => {
        if (!reasonCheck.success) {
          fail(reasonCheck.error.issues[0]?.message ?? "");
          return;
        }
        seal.mutate(
          {
            packId,
            packageId: pkg.packageId,
            values: {
              ...values,
              kitOverrideReason: askKitReason && reason ? reasonCheck.data : undefined,
            },
          },
          { onSuccess: onClose, onError: (error) => fail(transferPackErrorMessage(error)) },
        );
      }}
    />
  );
}

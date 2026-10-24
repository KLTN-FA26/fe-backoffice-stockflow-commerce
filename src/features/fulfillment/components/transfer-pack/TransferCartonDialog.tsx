"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { cartonInputSchema } from "@/features/fulfillment/transfer-pack-input-schemas";
import { transferPackErrorMessage } from "@/features/fulfillment/transfer-pack-errors";
import { useShipTransferCarton } from "@/features/fulfillment/transfer-pack-mutations";
import { Alert } from "@/components/shared/Alert";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FieldError, MONO, fieldClass } from "../primitives";
import { PackageTypeSelect } from "../packing/PackageTypeSelect";
import { TransferSealDialog } from "./TransferSealDialog";

import type { PackageType } from "@/features/fulfillment/packing-types";
import type { TransferCarton } from "@/features/fulfillment/transfer-pack-types";

const C = UI_LABELS.transferPack.carton;

/** Số đo gợi ý của thùng (vắng một số nào thì để trống ô đó cho người đóng cân / đo). */
function suggestedOf(carton: TransferCarton) {
  const { suggested } = carton;
  return {
    weightKg: suggested?.weightKg ?? undefined,
    lengthCm: suggested?.lengthCm ?? undefined,
    widthCm: suggested?.widthCm ?? undefined,
    heightCm: suggested?.heightCm ?? undefined,
  };
}

/**
 * Giao nguyên thùng (LP2-8, BE `POST …/cartons`): bước 1 quét LPN của thùng tồn kho chưa mở → BE mở một kiện chứa mọi
 * hàng của thùng; bước 2 người đóng xác nhận (cân, đo lại) số đo gợi ý theo đơn vị đóng gói rồi niêm phong. Đóng ở bước 2
 * thì kiện vẫn mở, niêm phong sau được ở danh sách kiện.
 */
export function TransferCartonDialog({ packId, onClose }: { packId: string; onClose: () => void }) {
  const ship = useShipTransferCarton();
  const [lpn, setLpn] = useState("");
  const [type, setType] = useState<PackageType>("CARTON");
  const [error, setError] = useState<string | null>(null);
  const [carton, setCarton] = useState<TransferCarton | null>(null);

  if (carton) {
    const initial = suggestedOf(carton);
    const missing = Object.values(initial).some((value) => value === undefined);
    return (
      <TransferSealDialog
        packId={packId}
        pkg={carton.parcel}
        initial={initial}
        askKitReason={false}
        onClose={onClose}
        hint={
          <Alert tone={missing ? "warning" : "info"} title={C.confirmTitle}>
            {C.confirmDescription(carton.lpn, carton.unitOfMeasure)}
            {missing && <span className="mt-1 block">{C.noSuggestion}</span>}
          </Alert>
        }
      />
    );
  }

  const submit = () => {
    const parsed = cartonInputSchema.safeParse({ lpn });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    ship.mutate(
      { packId, lpn: parsed.data.lpn, packageType: type },
      { onSuccess: setCarton, onError: (e) => setError(transferPackErrorMessage(e)) },
    );
  };

  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title={C.title}
        description={C.description}
        submitLabel={C.submit}
        canSubmit
        isPending={ship.isPending}
        error={null}
        onSubmit={submit}
        onCancel={onClose}
      >
        <div>
          <Label htmlFor="transfer-carton-lpn" className="text-[0.8125rem]">
            {C.lpn}
          </Label>
          <Input
            id="transfer-carton-lpn"
            autoFocus
            value={lpn}
            placeholder={C.lpnPlaceholder}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setLpn(event.target.value);
              setError(null);
            }}
            className={`${fieldClass(!!error)} ${MONO}`}
          />
          <FieldError>{error ?? undefined}</FieldError>
        </div>
        <PackageTypeSelect value={type} onChange={setType} className="w-full" />
      </FormDialogBody>
    </FormDialog>
  );
}

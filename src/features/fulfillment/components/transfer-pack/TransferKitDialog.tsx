"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { kitInputSchema } from "@/features/fulfillment/transfer-pack-input-schemas";
import { transferPackErrorMessage } from "@/features/fulfillment/transfer-pack-errors";
import { useOpenTransferKit } from "@/features/fulfillment/transfer-pack-mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { FieldError, MONO, fieldClass } from "../primitives";
import { PackageTypeSelect } from "../packing/PackageTypeSelect";

import type { PackageType } from "@/features/fulfillment/packing-types";
import type { TransferPackLine } from "@/features/fulfillment/transfer-pack-types";

const K = UI_LABELS.transferPack.kit;
const TRIGGER =
  "border-border-default bg-bg-surface h-8 w-full rounded-[var(--r-sm)] text-[0.8125rem]";

/**
 * Đóng bộ (LP2-6, BE `POST …/package-kits`): mở các kiện của MỘT đơn vị của dòng hàng đi nhiều thùng. Phần 1 nhận đơn vị
 * đó khi quét, mọi phần phải niêm phong trước khi hoàn tất. Số phần để trống thì BE lấy theo danh mục (422
 * `KIT_PART_COUNT_MISMATCH` nếu nhập lệch).
 */
export function TransferKitDialog({
  packId,
  lines,
  initialLineId,
  onClose,
}: {
  packId: string;
  /** Các dòng đi nhiều thùng (`packageCount` > 1). */
  lines: readonly TransferPackLine[];
  initialLineId?: string;
  onClose: () => void;
}) {
  const open = useOpenTransferKit();
  const [lineId, setLineId] = useState(initialLineId ?? "");
  const [partCount, setPartCount] = useState("");
  const [type, setType] = useState<PackageType>("CARTON");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const submit = () => {
    const parsed = kitInputSchema.safeParse({ transferLineId: lineId, partCount });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      );
      return;
    }
    open.mutate(
      {
        packId,
        transferLineId: parsed.data.transferLineId,
        partCount: parsed.data.partCount,
        packageType: type,
      },
      { onSuccess: onClose, onError: (e) => setServerError(transferPackErrorMessage(e)) },
    );
  };

  return (
    <FormDialog open onOpenChange={(next) => !next && onClose()}>
      <FormDialogBody
        title={K.title}
        description={lines.length === 0 ? K.noKitLines : K.description}
        submitLabel={K.submit}
        canSubmit={lines.length > 0}
        isPending={open.isPending}
        error={serverError}
        onSubmit={submit}
        onCancel={onClose}
      >
        <div>
          <Label htmlFor="transfer-kit-line" className="text-[0.8125rem]">
            {K.line}
          </Label>
          <Select
            value={lineId}
            onValueChange={(next) => {
              setLineId(next);
              setErrors({});
              setServerError(null);
            }}
          >
            <SelectTrigger id="transfer-kit-line" className={TRIGGER}>
              <SelectValue placeholder={K.linePlaceholder} />
            </SelectTrigger>
            <TitledSelectContent title={K.line}>
              {lines.map((line) => (
                <SelectItem key={line.transferLineId} value={line.transferLineId}>
                  {UI_LABELS.transferPack.scan.pickLineOption(
                    line.lineNo,
                    line.sku,
                    line.lotNumber,
                  )}
                </SelectItem>
              ))}
            </TitledSelectContent>
          </Select>
          <FieldError>{errors.transferLineId}</FieldError>
        </div>
        <div>
          <Label htmlFor="transfer-kit-parts" className="text-[0.8125rem]">
            {K.partCount}
          </Label>
          <Input
            id="transfer-kit-parts"
            inputMode="numeric"
            value={partCount}
            aria-invalid={errors.partCount ? true : undefined}
            onChange={(event) => {
              setPartCount(event.target.value);
              setErrors({});
              setServerError(null);
            }}
            className={`${fieldClass(!!errors.partCount)} ${MONO}`}
          />
          <p className="text-ink-tertiary mt-1 text-xs">{K.partCountHint}</p>
          <FieldError>{errors.partCount}</FieldError>
        </div>
        <PackageTypeSelect value={type} onChange={setType} className="w-full" />
      </FormDialogBody>
    </FormDialog>
  );
}

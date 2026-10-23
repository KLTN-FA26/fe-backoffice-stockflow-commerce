"use client";

import { useState } from "react";

import { PACKAGE_TYPES, UI_LABELS } from "@/constants";
import { sealInputSchema } from "@/features/fulfillment/packing-input-schemas";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { FlagSelect } from "./FlagSelect";
import { SealMeasureFields } from "./SealMeasureFields";

import type { ReactNode } from "react";
import type { FlagChoice, PackingSealValues } from "@/features/fulfillment/packing-input-schemas";
import type { PackageType } from "@/features/fulfillment/packing-types";

const L = UI_LABELS.packing;
const SEAL = L.seal;
const TRIGGER =
  "border-border-default bg-bg-surface h-8 w-full rounded-[var(--r-sm)] text-[0.8125rem]";

export type SealMeasures = Partial<
  Record<"weightKg" | "lengthCm" | "widthCm" | "heightCm", number>
>;

export interface SealFormDialogProps {
  packageNo: number;
  /** Loại kiện hiện tại (lạ / UNKNOWN → CARTON). */
  packageType: string;
  /** Số đo điền sẵn (vd gợi ý theo đơn vị đóng gói của thùng nguyên giao): người đóng vẫn phải cân đo lại. */
  initial?: SealMeasures;
  /** Dòng nhắc đặt trên form. */
  hint?: ReactNode;
  pending: boolean;
  /** Gọi mutation; `fail` hiện lỗi ngay trong hộp thoại, thành công thì cha tự đóng. */
  onSeal: (values: PackingSealValues, fail: (message: string) => void) => void;
  onClose: () => void;
}

const textOf = (value: number | undefined) => (value === undefined ? "" : String(value));

/**
 * Cân, đo, niêm phong (docs 08 bước 5–7, BR-03): bắt buộc khối lượng + dài × rộng × cao thực đo, BE
 * tính khối lượng quy đổi. Cờ xoay / dễ vỡ: để mặc định thì BE lấy từ SKU trong kiện (chặt nhất
 * thắng, E13); Có / Không là ghi đè của người đóng. Dùng chung cho kiện của đơn và của lệnh chuyển kho.
 */
export function SealFormDialog({
  packageNo,
  packageType,
  initial,
  hint,
  pending,
  onSeal,
  onClose,
}: SealFormDialogProps) {
  const [text, setText] = useState({
    weightKg: textOf(initial?.weightKg),
    lengthCm: textOf(initial?.lengthCm),
    widthCm: textOf(initial?.widthCm),
    heightCm: textOf(initial?.heightCm),
  });
  const [type, setType] = useState<PackageType>(
    PACKAGE_TYPES.find((t) => t === packageType) ?? "CARTON",
  );
  const [rotatable, setRotatable] = useState<FlagChoice>("default");
  const [fragile, setFragile] = useState<FlagChoice>("default");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const edit = (key: keyof typeof text) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setText((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setServerError(null);
  };

  const submit = () => {
    const parsed = sealInputSchema.safeParse({ ...text, packageType: type, rotatable, fragile });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      );
      return;
    }
    onSeal(parsed.data, setServerError);
  };

  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title={SEAL.title(packageNo)}
        description={SEAL.description}
        submitLabel={SEAL.submit}
        canSubmit
        isPending={pending}
        error={serverError}
        onSubmit={submit}
        onCancel={onClose}
      >
        {hint}
        <SealMeasureFields text={text} errors={errors} onEdit={edit} />
        <div>
          <Label htmlFor="seal-type" className="text-[0.8125rem]">
            {SEAL.packageType}
          </Label>
          <Select
            value={type}
            onValueChange={(next) => setType(PACKAGE_TYPES.find((t) => t === next) ?? "CARTON")}
          >
            <SelectTrigger id="seal-type" className={TRIGGER}>
              <SelectValue />
            </SelectTrigger>
            <TitledSelectContent title={SEAL.packageType}>
              {PACKAGE_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {L.packages.typeOption[value]}
                </SelectItem>
              ))}
            </TitledSelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FlagSelect
            id="seal-rotatable"
            label={SEAL.rotatable}
            value={rotatable}
            onChange={setRotatable}
          />
          <FlagSelect
            id="seal-fragile"
            label={SEAL.fragile}
            value={fragile}
            onChange={setFragile}
          />
        </div>
        <p className="text-ink-tertiary text-xs">{SEAL.flagHint}</p>
      </FormDialogBody>
    </FormDialog>
  );
}

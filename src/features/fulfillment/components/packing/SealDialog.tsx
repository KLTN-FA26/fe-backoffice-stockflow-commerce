"use client";

import { useState } from "react";

import { PACKAGE_TYPES, UI_LABELS } from "@/constants";
import { FLAG_CHOICES, sealInputSchema } from "@/features/fulfillment/packing-input-schemas";
import { packingErrorMessage } from "@/features/fulfillment/packing-errors";
import { useSealPackage } from "@/features/fulfillment/packing-mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { FieldError, MONO, fieldClass } from "../primitives";

import type { FlagChoice } from "@/features/fulfillment/packing-input-schemas";
import type { PackPackage, PackageType } from "@/features/fulfillment/packing-types";

const L = UI_LABELS.packing;
const SEAL = L.seal;
const TRIGGER =
  "border-border-default bg-bg-surface h-8 w-full rounded-[var(--r-sm)] text-[0.8125rem]";
const FLAG_LABEL: Record<FlagChoice, string> = {
  default: SEAL.flagFromSku,
  yes: SEAL.flagYes,
  no: SEAL.flagNo,
};
const MEASURES = [
  { key: "lengthCm", label: SEAL.length },
  { key: "widthCm", label: SEAL.width },
  { key: "heightCm", label: SEAL.height },
] as const;

function FlagSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: FlagChoice;
  onChange: (value: FlagChoice) => void;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-[0.8125rem]">
        {label}
      </Label>
      <Select
        value={value}
        onValueChange={(next) => onChange(FLAG_CHOICES.find((c) => c === next) ?? "default")}
      >
        <SelectTrigger id={id} className={TRIGGER}>
          <SelectValue />
        </SelectTrigger>
        <TitledSelectContent title={label}>
          {FLAG_CHOICES.map((choice) => (
            <SelectItem key={choice} value={choice}>
              {FLAG_LABEL[choice]}
            </SelectItem>
          ))}
        </TitledSelectContent>
      </Select>
    </div>
  );
}

/**
 * Cân, đo, niêm phong (docs 08 bước 5–7, BR-03): bắt buộc khối lượng + dài × rộng × cao thực đo, BE
 * tính khối lượng quy đổi. Cờ xoay / dễ vỡ: để mặc định thì BE lấy từ SKU trong kiện (chặt nhất
 * thắng, E13); Có / Không là ghi đè của người đóng.
 */
export function SealDialog({
  taskId,
  pkg,
  onClose,
}: {
  taskId: string;
  pkg: PackPackage;
  onClose: () => void;
}) {
  const seal = useSealPackage();
  const [text, setText] = useState({ weightKg: "", lengthCm: "", widthCm: "", heightCm: "" });
  const [type, setType] = useState<PackageType>(
    PACKAGE_TYPES.find((t) => t === pkg.packageType) ?? "CARTON",
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
    seal.mutate(
      { taskId, packageId: pkg.packageId, values: parsed.data },
      { onSuccess: onClose, onError: (error) => setServerError(packingErrorMessage(error)) },
    );
  };

  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title={SEAL.title(pkg.packageNo)}
        description={SEAL.description}
        submitLabel={SEAL.submit}
        canSubmit
        isPending={seal.isPending}
        error={serverError}
        onSubmit={submit}
        onCancel={onClose}
      >
        <div>
          <Label htmlFor="seal-weight" className="text-[0.8125rem]">
            {SEAL.weight}
          </Label>
          <Input
            id="seal-weight"
            autoFocus
            inputMode="decimal"
            value={text.weightKg}
            aria-invalid={errors.weightKg ? true : undefined}
            onChange={edit("weightKg")}
            className={`${fieldClass(!!errors.weightKg)} ${MONO}`}
          />
          <FieldError>{errors.weightKg}</FieldError>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {MEASURES.map(({ key, label }) => (
            <div key={key}>
              <Label htmlFor={`seal-${key}`} className="text-[0.8125rem]">
                {label}
              </Label>
              <Input
                id={`seal-${key}`}
                inputMode="decimal"
                value={text[key]}
                aria-invalid={errors[key] ? true : undefined}
                onChange={edit(key)}
                className={`${fieldClass(!!errors[key])} ${MONO}`}
              />
              <FieldError>{errors[key]}</FieldError>
            </div>
          ))}
        </div>
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

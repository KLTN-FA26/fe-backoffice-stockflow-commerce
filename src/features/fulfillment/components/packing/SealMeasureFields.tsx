"use client";

import { UI_LABELS } from "@/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FieldError, MONO, fieldClass } from "../primitives";

const SEAL = UI_LABELS.packing.seal;
const MEASURES = [
  { key: "lengthCm", label: SEAL.length },
  { key: "widthCm", label: SEAL.width },
  { key: "heightCm", label: SEAL.height },
] as const;

export type SealMeasureKey = "weightKg" | (typeof MEASURES)[number]["key"];

/** Khối lượng thực + dài × rộng × cao thực đo của form niêm phong (BR-03); lỗi từng ô hiện ngay dưới ô. */
export function SealMeasureFields({
  text,
  errors,
  onEdit,
}: {
  text: Record<SealMeasureKey, string>;
  errors: Record<string, string>;
  onEdit: (key: SealMeasureKey) => (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
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
          onChange={onEdit("weightKg")}
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
              onChange={onEdit(key)}
              className={`${fieldClass(!!errors[key])} ${MONO}`}
            />
            <FieldError>{errors[key]}</FieldError>
          </div>
        ))}
      </div>
    </>
  );
}

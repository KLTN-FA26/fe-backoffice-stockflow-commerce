/**
 * Nối trình chia thùng (controlled) với react-hook-form của hai form kiểm đếm (phiếu theo PO, phiếu không có PO).
 */

import type { FieldErrors } from "react-hook-form";
import type { CartonDraft, CartonEditorErrors } from "./CartonEditor";

/** Phần thùng của một dòng form kiểm đếm (Input của `cartonLineFields`). */
interface CartonLineInput {
  unitOfMeasure?: string;
  packages?: { lpn?: string; quantity: number }[];
}

export function cartonDraftOf(line: CartonLineInput | undefined): CartonDraft {
  return {
    unitOfMeasure: line?.unitOfMeasure ?? "",
    packages: (line?.packages ?? []).map((carton) => ({
      lpn: carton.lpn ?? "",
      quantity: carton.quantity,
    })),
  };
}

/** Lỗi zod / server của ô đơn vị, cả danh sách thùng (`root` với field array) và từng thùng. */
export function cartonEditorErrors(
  errors: FieldErrors<CartonLineInput> | undefined,
): CartonEditorErrors {
  const packages = errors?.packages;
  return {
    unit: errors?.unitOfMeasure?.message,
    packages: packages?.root?.message ?? packages?.message,
    carton: (index) => ({
      quantity: packages?.[index]?.quantity?.message,
      lpn: packages?.[index]?.lpn?.message,
    }),
  };
}

/** Ghi thùng mới vào form: dirty + validate lại ngay để báo lỗi inline. */
export const CARTON_SET_OPTIONS = { shouldDirty: true, shouldValidate: true } as const;

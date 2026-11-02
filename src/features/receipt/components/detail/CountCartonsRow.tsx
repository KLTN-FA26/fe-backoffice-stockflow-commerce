"use client";

import { CartonEditor } from "../cartons/CartonEditor";
import { cartonDraftOf, cartonEditorErrors } from "../cartons/carton-form";

import type { FieldErrors } from "react-hook-form";
import type { LineCartonContext } from "@/features/receipt/carton-selectors";
import type { ReceiptLinesFormInput } from "@/features/receipt/types";
import type { CartonDraft } from "../cartons/CartonEditor";

/** Hàng mở rộng ngay dưới dòng kiểm đếm: trình chia thùng của dòng (Q2 đã duyệt). */
export function CountCartonsRow({
  index,
  colSpan,
  line,
  context,
  errors,
  onChange,
}: {
  index: number;
  colSpan: number;
  line: ReceiptLinesFormInput["lines"][number] | undefined;
  context: LineCartonContext;
  errors: FieldErrors<ReceiptLinesFormInput>["lines"];
  onChange: (next: CartonDraft) => void;
}) {
  return (
    <tr className="border-border-default border-t">
      <td colSpan={colSpan} className="bg-bg-subtle px-3 py-3">
        <CartonEditor
          lineNo={index + 1}
          quantity={Number(line?.quantity) || 0}
          value={cartonDraftOf(line)}
          context={context}
          errors={cartonEditorErrors(errors?.[index])}
          onChange={onChange}
        />
      </td>
    </tr>
  );
}

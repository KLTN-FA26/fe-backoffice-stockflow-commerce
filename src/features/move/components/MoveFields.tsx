import { MOVE_LABELS, MOVE_LIMITS } from "@/constants/move";

import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { UseFormReturn } from "react-hook-form";
import type { MoveCreateInput } from "../types";

const DESTINATION_LIST_ID = "move-toLocation-options";

/**
 * Vị trí đích (docs 11 §4.1 bước 2): quét / gõ mã vị trí, gợi ý các vị trí dùng được của kho (không khu tập kết, khác vị
 * trí hiện tại của các thùng). `problem` là lỗi chéo với danh sách thùng (thùng đã ở sẵn đích) — không nằm trong zod.
 */
export function MoveFields({
  form,
  destinations,
  problem,
}: {
  form: UseFormReturn<MoveCreateInput>;
  destinations: readonly string[];
  problem: string | null;
}) {
  const {
    register,
    formState: { errors },
  } = form;
  const message = errors.toLocation?.message ?? problem ?? undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor="move-toLocation">{MOVE_LABELS.toLocation} *</Label>
      <Input
        className={FORM_INPUT_CLASS}
        id="move-toLocation"
        {...register("toLocation")}
        maxLength={MOVE_LIMITS.locationLength}
        autoComplete="off"
        list={DESTINATION_LIST_ID}
        aria-invalid={Boolean(message)}
        aria-describedby={`move-toLocation-error${destinations.length ? " move-toLocation-help" : ""}`}
      />
      <datalist id={DESTINATION_LIST_ID}>
        {destinations.map((code) => (
          <option key={code} value={code} />
        ))}
      </datalist>
      {destinations.length > 0 && (
        <p id="move-toLocation-help" className="text-ink-secondary text-sm">
          {MOVE_LABELS.toLocationHelp}
        </p>
      )}
      <p
        id="move-toLocation-error"
        role={message ? "alert" : undefined}
        className="text-danger text-sm"
      >
        {message}
      </p>
    </div>
  );
}

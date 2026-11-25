import { BinSuggestions } from "./BinSuggestions";
import { MoveFields } from "./MoveFields";

import type { UseFormReturn } from "react-hook-form";
import type { BinSuggestions as Suggestions, MoveCreateInput } from "../types";

/**
 * Cột vị trí đích của modal chuyển thùng (docs 11 §4.1 bước 2): ô quét / gõ mã + bin gợi ý ngay dưới (BE #412). Bấm một
 * gợi ý là điền ô đích; gõ / quét mã khác vẫn được — gợi ý chỉ để tham khảo.
 */
export function DestinationPanel({
  form,
  destinations,
  problem,
  suggestions,
  value,
  disabled,
  onPick,
}: {
  form: UseFormReturn<MoveCreateInput>;
  destinations: readonly string[];
  problem: string | null;
  suggestions: {
    hasCartons: boolean;
    data: Suggestions | undefined;
    isLoading: boolean;
    isError: boolean;
  };
  value: string;
  disabled: boolean;
  onPick: (code: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-3">
      <MoveFields form={form} destinations={destinations} problem={problem} />
      <BinSuggestions {...suggestions} value={value} disabled={disabled} onChoose={onPick} />
    </div>
  );
}

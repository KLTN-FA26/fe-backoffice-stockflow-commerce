import { useEffect } from "react";

import { useRecentCarrierId } from "@/features/shipping/queries";

import type { UseFormReturn } from "react-hook-form";
import type { BookingFormInput, BookingValues, Carrier } from "@/features/shipping/types";

/**
 * Điền sẵn hãng khi đặt xe (R6, S17-3): chỉ một hãng đang dùng → chọn sẵn (chuyến đã có hãng — đặt lại — giữ hãng đó);
 * trả hãng dùng gần nhất của kho để ô chọn đưa lên đầu (`null` khi chưa biết / không đọc được).
 */
export function useCarrierDefaults(
  form: UseFormReturn<BookingFormInput, unknown, BookingValues>,
  warehouseId: string,
  carriers: readonly Pick<Carrier, "carrierId">[] | undefined,
): string | null {
  const only = carriers?.length === 1 ? (carriers[0]?.carrierId ?? "") : "";
  useEffect(() => {
    if (only && !form.getValues("carrierId"))
      form.setValue("carrierId", only, { shouldValidate: true });
  }, [only, form]);
  return useRecentCarrierId(warehouseId).data ?? null;
}

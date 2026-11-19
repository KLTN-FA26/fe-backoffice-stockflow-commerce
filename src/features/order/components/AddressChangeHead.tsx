import { MapPin } from "lucide-react";

import { ORDER_HISTORY_LABELS as L } from "@/constants";

/** Đầu mục lịch sử "Đổi địa chỉ giao" (BE `ADDRESS_CHANGE`, docs 17 BR-16): địa chỉ cũ → mới, mỗi địa chỉ một dòng. */
export function AddressChangeHead({ from, to }: { from: string | null; to: string }) {
  return (
    <span className="text-ink-primary block">
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <MapPin className="text-accent size-3.5" aria-hidden="true" />
        {L.addressChanged}
      </span>
      {from && (
        <span className="text-ink-secondary mt-1 block break-words">
          {L.addressFrom}: {from}
        </span>
      )}
      <span className="mt-0.5 block break-words">
        {L.addressTo}: {to}
      </span>
    </span>
  );
}

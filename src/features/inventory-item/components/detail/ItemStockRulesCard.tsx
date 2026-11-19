import { ShieldCheck } from "lucide-react";

import { UI_LABELS } from "@/constants";

import { DefinitionItem, ItemCardShell } from "./ItemCardShell";

const R = UI_LABELS.inventoryItem.stockRules;

/**
 * Chính sách tồn CỐ ĐỊNH cho mọi SKU (kltn-docs 01 §3 "Chính sách tồn", BR-17, chốt 2026-11-05): theo dõi
 * theo lô (lô = mã Đơn sản xuất, gán khi nhập kho), không serial, không hạn dùng, xuất FIFO. BE không có
 * gì để cấu hình (đã bỏ `PUT /inventory/items/{id}/policy`) nên thẻ chỉ nêu luật, không có nút sửa.
 */
export function ItemStockRulesCard() {
  return (
    <ItemCardShell title={R.title} icon={ShieldCheck}>
      <dl>
        <DefinitionItem label={R.tracking} value={R.trackingValue} />
        <DefinitionItem label={R.serial} value={R.serialValue} />
        <DefinitionItem label={R.expiry} value={R.expiryValue} />
        <DefinitionItem label={R.removal} value={R.removalValue} />
      </dl>
      <p className="text-ink-tertiary mt-3 text-xs">{R.hint}</p>
    </ItemCardShell>
  );
}

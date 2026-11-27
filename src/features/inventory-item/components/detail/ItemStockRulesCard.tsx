import { UI_LABELS } from "@/constants";

import { DetailPanel, Fact, FactGrid } from "@/components/shared/DetailPanel";

const R = UI_LABELS.inventoryItem.stockRules;

/**
 * Chính sách tồn CỐ ĐỊNH cho mọi SKU (kltn-docs 01 §3 "Chính sách tồn", BR-17, chốt 2026-11-05): theo dõi
 * theo lô (lô = mã Đơn sản xuất, gán khi nhập kho), không serial, không hạn dùng, xuất FIFO. BE không có
 * gì để cấu hình (đã bỏ `PUT /inventory/items/{id}/policy`) nên panel chỉ nêu luật, không có nút sửa.
 */
export function ItemStockRulesCard() {
  return (
    <DetailPanel title={R.title} description={R.hint}>
      <FactGrid>
        <Fact label={R.tracking}>{R.trackingValue}</Fact>
        <Fact label={R.serial}>{R.serialValue}</Fact>
        <Fact label={R.expiry}>{R.expiryValue}</Fact>
        <Fact label={R.removal}>{R.removalValue}</Fact>
      </FactGrid>
    </DetailPanel>
  );
}

import { Gauge } from "lucide-react";

import { UI_LABELS } from "@/constants";

import { evaluationState } from "../../selectors";
import { DefinitionItem, ItemCardShell } from "./ItemCardShell";

import type { InventoryItem } from "../../types";

const L = UI_LABELS.inventoryItem;

const TEXT = { yes: L.evaluation.yes, no: L.evaluation.no, unset: L.evaluation.unset };
// Cần đặt lại = cảnh báo (amber); dưới mức an toàn nghiêm trọng hơn = nguy hiểm (đỏ); chưa đặt ngưỡng trung tính
const REORDER_TONE = { yes: "text-warning", no: "text-positive", unset: "text-ink-tertiary" };
const SAFETY_TONE = { yes: "text-danger", no: "text-positive", unset: "text-ink-tertiary" };

const show = (v: number | null | undefined) => (v == null ? L.policy.notSet : String(v));

/** Đánh giá ngưỡng do BE tính (tồn khả dụng so với điểm đặt lại / tồn an toàn). */
export function ItemEvaluationCard({ item }: { item: InventoryItem }) {
  const e = item.evaluation;
  const state = evaluationState(e);

  return (
    <ItemCardShell title={L.evaluationTitle} icon={Gauge}>
      <dl className="tabular-nums">
        {/* Trang chi tiết không có tiêu đề — SKU và phiên bản bản ghi nằm ở đây */}
        <DefinitionItem label={L.field.sku} value={item.sku} mono />
        <DefinitionItem label={L.field.version} value={item.version} mono />
        <DefinitionItem label={L.field.usableOnHand} value={e.usableOnHand} mono />
        <DefinitionItem label={L.field.reorderPoint} value={show(e.reorderPoint)} />
        <DefinitionItem label={L.field.safetyStock} value={show(e.safetyStock)} />
        <DefinitionItem
          label={L.field.reorderRequired}
          value={<span className={REORDER_TONE[state.reorder]}>{TEXT[state.reorder]}</span>}
        />
        <DefinitionItem
          label={L.field.belowSafetyStock}
          value={<span className={SAFETY_TONE[state.belowSafety]}>{TEXT[state.belowSafety]}</span>}
        />
      </dl>
    </ItemCardShell>
  );
}

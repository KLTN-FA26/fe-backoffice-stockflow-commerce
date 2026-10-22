import { LOAD_PLANNING_LABELS } from "@/constants";

import { Badge } from "@/components/ui/badge";

import type { KitBalance } from "../../lib/kit-balance";

/**
 * Huy hiệu cân bằng bộ: xanh khi mọi xe đủ tỉ lệ các thành phần của từng bộ, đỏ kèm chi tiết xe/bộ
 * bị lệch. Không có bộ nào thì không hiện gì. (Gốc: `balanceOk` + badge trong `kit-packing.tsx`.)
 */
export function KitBalanceBadge({ balance }: { balance: KitBalance }) {
  if (balance.vehicles.length === 0) return null;
  const labels = LOAD_PLANNING_LABELS.kitBalance;
  if (balance.ok) return <Badge className="bg-positive text-ink-inverse">{labels.balanced}</Badge>;
  const detail = balance.vehicles
    .filter((v) => v.sets === null)
    .map((v) => labels.unbalancedDetail(v.vehicleSeq, v.group))
    .join("; ");
  return (
    <Badge variant="destructive" title={detail}>
      {labels.unbalanced}
    </Badge>
  );
}

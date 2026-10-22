import { Boxes, Gauge, Package, Ruler, Scale, TriangleAlert } from "lucide-react";

import { LOAD_PLANNING_LABELS, LOAD_PLANNING_LIMITS } from "@/constants";

import { formatNumber, formatPercent } from "@/lib/format";

import { formatM3 } from "../../lib/dims";

import { MetricsStrip } from "./MetricsStrip";

import type { LayoutSummary } from "../../selectors";
import type { MetricItem } from "./MetricsStrip";

/** Dải số liệu của một kế hoạch/ước lượng: xe, kiện, thể tích, hiệu suất, khối lượng, hàng chưa xếp. */
export function LayoutMetrics({ summary }: { summary: LayoutSummary }) {
  const labels = LOAD_PLANNING_LABELS.metrics;
  const items: MetricItem[] = [
    {
      label: labels.vehicles,
      value: formatNumber(summary.vehicles),
      icon: <Boxes className="size-4" />,
    },
    {
      label: labels.pieces,
      value: formatNumber(summary.pieces),
      icon: <Package className="size-4" />,
      tone: "good",
    },
    {
      label: labels.volume,
      value: formatM3(summary.usedVolumeMm3),
      icon: <Ruler className="size-4" />,
      tone: "good",
    },
    {
      label: labels.utilization,
      value: formatPercent(summary.utilization, 2),
      icon: <Gauge className="size-4" />,
      tone: summary.utilization < LOAD_PLANNING_LIMITS.lowUtilizationRatio ? "warn" : "good",
    },
    {
      label: labels.weight,
      value: `${formatNumber(summary.usedWeightKg)} / ${formatNumber(summary.payloadKg)} kg`,
      icon: <Scale className="size-4" />,
      tone: summary.overweightVehicles > 0 ? "bad" : "default",
    },
    {
      label: labels.unplaced,
      value: formatNumber(summary.unplacedPieces),
      icon: <TriangleAlert className="size-4" />,
      tone: summary.unplacedPieces > 0 ? "bad" : "good",
    },
  ];
  return <MetricsStrip items={items} />;
}

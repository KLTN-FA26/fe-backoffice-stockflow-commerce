import { AlertTriangle, CheckCircle2, CircleDashed, CircleHelp } from "lucide-react";

import { QUOTE_FORM_LABELS } from "@/constants/labels-quote-form";

import type { LucideIcon } from "lucide-react";
import type { LinePriceVerdict } from "@/features/quote/selectors";

const V = QUOTE_FORM_LABELS.summary.verdict;

const LOOK: Record<LinePriceVerdict, { icon: LucideIcon; text: string; icon2: string }> = {
  ok: { icon: CheckCircle2, text: "text-positive-ink", icon2: "text-dot-positive" },
  needsApproval: { icon: AlertTriangle, text: "text-warning-ink", icon2: "text-dot-warning" },
  noPrice: { icon: CircleHelp, text: "text-warning-ink", icon2: "text-dot-warning" },
  unknown: { icon: CircleDashed, text: "text-ink-tertiary", icon2: "text-ink-tertiary" },
};

/**
 * Kết luận xem trước luật duyệt giá của một dòng (14 BR-10): chữ kèm icon (WCAG 1.4.1 — không chỉ màu). Xanh = đạt, cam =
 * cần Quản lý kinh doanh duyệt / chưa có giá, xám = hệ thống kiểm khi gửi.
 */
export function LinePriceVerdictChip({ verdict }: { verdict: LinePriceVerdict }) {
  const look = LOOK[verdict];
  const Icon = look.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium whitespace-nowrap ${look.text}`}
    >
      <Icon className={`size-3.5 ${look.icon2}`} aria-hidden="true" />
      {V[verdict]}
    </span>
  );
}

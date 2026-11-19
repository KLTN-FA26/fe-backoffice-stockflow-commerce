import { TRIAL_LABELS } from "@/constants";
import { Badge } from "@/components/ui/badge";

const L = TRIAL_LABELS.guide;

/**
 * Khung "Cách đọc file" bên phải (artboard `thuc-hien-don--load-estimates-trial`): cột nào bắt buộc, cột nào tuỳ chọn,
 * đơn vị, và một dòng = một dòng hàng (chế độ Giữ nguyên dòng). Chỉ là chữ giải thích, không có thao tác.
 */
export function TrialFileGuide() {
  return (
    <aside aria-label={L.title} className="space-y-3 text-[0.8125rem]">
      <h2 className="text-ink-primary text-sm font-semibold">{L.title}</h2>
      <dl className="divide-y divide-[var(--table-line)]">
        {L.columns.map((column) => (
          <div key={column.name} className="flex items-start justify-between gap-2 py-1.5">
            <div className="min-w-0">
              <dt className="text-ink-primary font-mono text-xs">{column.name}</dt>
              <dd className="text-ink-tertiary text-xs">{column.note}</dd>
            </div>
            <Badge variant={column.required ? "secondary" : "outline"}>
              {column.required ? L.required : L.optional}
            </Badge>
          </div>
        ))}
      </dl>
      <p className="text-ink-secondary text-xs">{L.units}</p>
      <p className="text-ink-secondary text-xs">{L.lines}</p>
      <div className="border-border-default rounded-[var(--r-sm)] border p-2.5">
        <p className="text-ink-primary text-xs font-medium">{L.safeTitle}</p>
        <p className="text-ink-tertiary text-xs">{L.safe}</p>
      </div>
    </aside>
  );
}

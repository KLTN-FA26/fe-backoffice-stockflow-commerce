import { MODEL3D_VIEW_LABELS as LABELS } from "@/constants/labels-model3d";

/** How to read the grid, once: its lines and numbers, the stretch on a tapered cup, and what bleed and safe margin are. */
export function PrintLegend({ tapered }: { tapered: boolean }) {
  return (
    <div className="border-border-default bg-bg-subtle space-y-1 rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h4 className="text-ink-primary text-sm font-semibold">{LABELS.legendTitle}</h4>
      <ul className="text-ink-secondary list-disc space-y-1 pl-5 text-[0.8125rem]">
        <li>{LABELS.legend.lines}</li>
        {tapered && <li>{LABELS.legend.cup}</li>}
        <li>{LABELS.legend.margins}</li>
      </ul>
    </div>
  );
}

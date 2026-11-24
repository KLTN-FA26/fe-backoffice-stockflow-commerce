"use client";

import { MODEL3D_VIEW_LABELS as LABELS } from "@/constants/labels-model3d";

import { isCylindricalCup } from "../../model3d/cup-sector";
import { ExpandablePanel } from "./ExpandablePanel";
import { ModelStage } from "./ModelStage";
import { PrintLegend } from "./PrintLegend";
import { PrintSheets } from "./PrintSheets";
import { useThemeStamp } from "./use-theme-stamp";

import type { ModelStageProps } from "./ModelStage";

/**
 * The visual check: the loaded model with a numbered grid on each print part, and the same grid on the flat sheets,
 * side by side (one row on wide screens) so a number on the model is found on its sheet without scrolling; each panel
 * can be expanded over the page. Loaded on demand by `ModelViewSlot` (three.js and react-three-fiber come with it),
 * only when there is something to show.
 */
export function PrintModelView(props: Omit<ModelStageProps, "stamp" | "fill">) {
  const stamp = useThemeStamp();
  const { template, model } = props;
  return (
    <section aria-labelledby="print-config-view" className="space-y-3">
      <h3 id="print-config-view" className="text-ink-primary text-sm font-semibold">
        {LABELS.title}
      </h3>
      <p className="text-ink-secondary text-[0.8125rem]">{LABELS.intro}</p>
      <div className="grid items-stretch gap-3 xl:grid-cols-2">
        {/* The flat sheet on the left, the 3D model on the right. */}
        <ExpandablePanel title={LABELS.sheetsTitle} centered>
          {(expanded) => (
            <PrintSheets template={template} model={model} stamp={stamp} large={expanded} />
          )}
        </ExpandablePanel>
        <ExpandablePanel title={LABELS.modelTitle}>
          {(expanded) => <ModelStage {...props} stamp={stamp} fill={expanded} />}
        </ExpandablePanel>
      </div>
      <PrintLegend tapered={model.kind === "parametric-cup" && !isCylindricalCup(model)} />
    </section>
  );
}

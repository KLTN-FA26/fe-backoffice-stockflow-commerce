"use client";

/**
 * The place of the 3D view on the upload screen. It decides whether there is something to show: a file has been read,
 * a whole model could be derived and no issue is an error. Then, and only then, the view is loaded (`next/dynamic`,
 * not on the server): three.js and react-three-fiber stay out of the page's first load. Otherwise one sentence says
 * why there is no view.
 */
import dynamic from "next/dynamic";
import { useMemo } from "react";

import { MODEL3D_VIEW_LABELS as LABELS } from "@/constants/labels-model3d";
import { Alert } from "@/components/shared/Alert";
import { Skeleton } from "@/components/shared/Skeleton";

import { templateOfSource } from "./save-input";
import { useSettledDefaults } from "./use-settled-defaults";

import type { ModelIssue } from "../model3d/issues";
import type { PrintDefaultsValues } from "./print-defaults";
import type { MeasuredFile } from "./use-glb-reading";

const PrintModelView = dynamic(
  () => import("./model-view/PrintModelView").then((module) => module.PrintModelView),
  {
    ssr: false,
    loading: () => <Skeleton role="status" aria-label={LABELS.loading} className="h-112 w-full" />,
  },
);

export interface ModelViewSlotProps {
  /** The file read, or `null` while none is chosen. */
  result: MeasuredFile | null;
  /** Every issue shown for it: the file's and the manufacturer's-figures ones. */
  issues: readonly ModelIssue[];
  defaults: PrintDefaultsValues;
}

function Reason({ children }: { children: string }) {
  return (
    <Alert tone="info">
      <span role="status">{children}</span>
    </Alert>
  );
}

export function ModelViewSlot({ result, issues, defaults }: ModelViewSlotProps) {
  const settled = useSettledDefaults(defaults);
  const derived = useMemo(() => {
    if (!result?.model) return null;
    try {
      const source = { model: result.model, printMeshes: result.parts };
      return templateOfSource({ source, stored: null, defaults: settled });
    } catch {
      return null;
    }
  }, [result, settled]);

  if (!result) return null;
  if (issues.some((issue) => issue.level === "error")) {
    return <Reason>{LABELS.noViewErrors}</Reason>;
  }
  if (!result.model) return <Reason>{LABELS.noViewBag}</Reason>;
  if (!derived) return <Reason>{LABELS.noViewDefaults}</Reason>;
  return (
    <PrintModelView
      key={result.root.uuid}
      root={result.root}
      parts={result.parts}
      template={derived.template}
      model={derived.model}
    />
  );
}

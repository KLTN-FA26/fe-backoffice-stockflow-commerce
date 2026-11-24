"use client";

import { useEffect, useMemo, useState } from "react";
import { Box3 } from "three";

import { MODEL3D_TEMPLATE_LABELS, MODEL3D_VIEW_LABELS as LABELS } from "@/constants/labels-model3d";
import { cn } from "cn";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import { framingOf, viewTargets } from "./camera-views";
import { PrintModelCanvas } from "./PrintModelCanvas";
import { usePrintView } from "./use-print-view";

import type { PrintAreaCode } from "../../model3d/model-types";
import type { ViewTarget } from "./camera-views";
import type { TurnRequest } from "./CameraRig";
import type { ModelStageProps } from "./ModelStage";

const partName = (code: PrintAreaCode) =>
  code === "BODY" ? MODEL3D_TEMPLATE_LABELS.cupBody : MODEL3D_TEMPLATE_LABELS.faces[code];

/** The view is gone (a lost context, or a throw while building it): what happened and how to get it back. */
export const stoppedAlert = (
  <div role="alert">
    <Alert tone="warning" title={LABELS.stoppedTitle}>
      {LABELS.stoppedText}
    </Alert>
  </div>
);

/**
 * Everything that needs WebGL or builds on it, so that `StageBoundary` catches a throw from any of it: the grid meshes
 * (built by an effect), the canvas and the turn controls. A lost context ends the view: nothing is built any more and
 * what was added is taken away (`usePrintView`), until another file (a new `root`) mounts a new scene.
 */
export function StageScene({ root, parts, template, model, stamp, fill = false }: ModelStageProps) {
  const [lost, setLost] = useState(false);
  const [request, setRequest] = useState<TurnRequest | null>(null);
  const view = usePrintView({ root, parts, template, model, enabled: !lost, stamp });
  const framing = useMemo(() => {
    root.updateMatrixWorld(true);
    return framingOf(new Box3().setFromObject(root));
  }, [root]);
  const targets = viewTargets(
    model.kind === "parametric-cup" ? "cup" : "bag",
    template.printAreas.map((area) => area.code),
  );
  const turn = ({ direction }: ViewTarget) =>
    setRequest((current) => ({ direction, nonce: (current?.nonce ?? 0) + 1 }));
  const failures = view?.failures;
  useEffect(() => {
    // The raw reason is English, from three.js or the geometry code: for the console, not for the person.
    failures?.forEach(({ name, reason }) => console.warn(`Print grid failed for ${name}:`, reason));
  }, [failures]);

  if (lost) return stoppedAlert;
  return (
    <div className={cn("flex flex-col gap-3", fill && "h-full")}>
      {/* The turn controls sit inside the stage, over its bottom edge, so they read as part of the 3D view. */}
      <div
        className={cn(
          "border-border-default bg-bg-subtle relative overflow-hidden rounded-[var(--card-radius)] border",
          fill ? "min-h-96 flex-1" : "h-112",
        )}
      >
        <div role="group" aria-label={LABELS.canvas} className="absolute inset-0">
          <PrintModelCanvas
            root={root}
            view={view}
            framing={framing}
            request={request}
            onLost={() => setLost(true)}
          />
        </div>
        <div
          role="group"
          aria-label={LABELS.turnGroup}
          className="absolute inset-x-2 bottom-2 flex flex-wrap justify-center gap-2"
        >
          {targets.map((target) => (
            <Button
              key={target.id}
              type="button"
              variant="outline"
              size="sm"
              className="bg-bg-surface/90 backdrop-blur-sm"
              onClick={() => turn(target)}
            >
              {target.label}
            </Button>
          ))}
        </div>
      </div>
      {failures?.map(({ code, name }) => (
        <div role="alert" key={code}>
          <Alert tone="danger" title={LABELS.failureTitle(`${partName(code)} (${name})`)}>
            {LABELS.failureText}
          </Alert>
        </div>
      ))}
    </div>
  );
}

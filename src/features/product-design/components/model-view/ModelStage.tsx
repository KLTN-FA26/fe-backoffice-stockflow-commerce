"use client";

import { useState } from "react";

import { MODEL3D_VIEW_LABELS as LABELS } from "@/constants/labels-model3d";
import { Alert } from "@/components/shared/Alert";

import { StageBoundary } from "./StageBoundary";
import { StageScene, stoppedAlert } from "./StageScene";
import { hasWebGl } from "./webgl";

import type { Object3D } from "three";
import type {
  BagModel,
  CupModel,
  CustomizationTemplate,
  PrintAreaCode,
} from "../../model3d/model-types";

const noWebGl = (
  <div role="alert">
    <Alert tone="warning" title={LABELS.noWebGlTitle}>
      {LABELS.noWebGlText}
    </Alert>
  </div>
);

export interface ModelStageProps {
  root: Object3D;
  parts: readonly { printAreaCode: PrintAreaCode }[];
  template: CustomizationTemplate;
  model: CupModel | BagModel;
  stamp: string;
}

/**
 * The model with the numbered grid on each print part, and the controls that turn it to each print area. Without
 * WebGL it says so and builds nothing. The scene, including the building of the grids, is inside the boundary: a
 * throw there shows "the view stopped" and leaves the flat sheets and the rest of the screen as they are; a part whose
 * grid cannot be made is named and left as the file has it.
 */
export function ModelStage(props: ModelStageProps) {
  const [webGl] = useState(hasWebGl);
  if (!webGl) return noWebGl;
  return (
    <StageBoundary fallback={stoppedAlert}>
      <StageScene {...props} />
    </StageBoundary>
  );
}

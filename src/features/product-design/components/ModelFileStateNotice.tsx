import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { Alert } from "@/components/shared/Alert";

import { surfaceFaultMessage } from "../surfaces";

import type { ModelFileState } from "../selectors";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.fileState;

/**
 * What the stored `.glb` allows without a new file (`modelFileStateOf`): nothing to say for a complete configuration;
 * free edits only for one written before files were required; nothing until a file is uploaded for one without a model
 * or whose area ↔ mesh table the BE refuses (each area at fault named).
 */
export function ModelFileStateNotice({ state }: { state: ModelFileState | null }) {
  if (!state || state.kind === "ready") return null;
  if (state.kind === "no-file") {
    return (
      <Alert tone="info" title={TEXT.noFileTitle}>
        {TEXT.noFileBody}
      </Alert>
    );
  }
  if (state.kind === "no-model") {
    return (
      <Alert tone="info" title={TEXT.noModelTitle}>
        {TEXT.noModelBody}
      </Alert>
    );
  }
  return (
    <div role="alert">
      <Alert tone="warning" title={TEXT.brokenTitle}>
        <ul className="list-disc space-y-0.5 pl-4">
          {state.faults.map((fault, i) => (
            <li key={`${fault.kind}-${fault.code}-${i}`}>{surfaceFaultMessage(fault)}</li>
          ))}
        </ul>
        <span className="mt-1 block">{TEXT.brokenBody}</span>
      </Alert>
    </div>
  );
}

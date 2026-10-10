import { useState } from "react";

import { Button } from "@/components/ui/button";

import { INVENTORY_CONTROL_TEXT as text } from "../inventory-control/constants";
import { InventoryControlEditor } from "./InventoryControlEditor";
import { InventoryControlPolicyView } from "./InventoryControlPolicyView";

import type { InventoryControlViewModel } from "../inventory-control/view-model";

export function InventoryControlWorkspace({
  value,
  canEdit,
  reload,
  revision,
}: {
  value: InventoryControlViewModel;
  canEdit: boolean;
  reload: () => Promise<InventoryControlViewModel>;
  revision: number;
}) {
  const [state, setState] = useState<{
    observed: InventoryControlViewModel;
    revision: number;
    accepted: InventoryControlViewModel;
    base: InventoryControlViewModel | null;
  }>({ observed: value, revision, accepted: value, base: null });
  // Observe background data without rebasing an edit. Cancel retains its accepted local base.
  if (value !== state.observed || revision !== state.revision)
    setState({
      ...state,
      observed: value,
      revision,
      accepted: state.base ? state.accepted : value,
    });
  if (state.base)
    return (
      <>
        <InventoryControlEditor
          base={state.base}
          canEdit={canEdit}
          reload={reload}
          onCancel={() => setState((current) => ({ ...current, base: null }))}
          onReload={(accepted) =>
            setState({ observed: accepted, revision, accepted, base: accepted })
          }
          onSaved={(accepted) => setState({ observed: accepted, revision, accepted, base: null })}
        />
        <InventoryControlPolicyView value={state.accepted} showPolicy={false} />
      </>
    );
  return (
    <>
      <InventoryControlPolicyView value={state.accepted} />
      {canEdit && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setState((current) => ({ ...current, base: current.accepted }))}
        >
          {text.edit}
        </Button>
      )}
    </>
  );
}

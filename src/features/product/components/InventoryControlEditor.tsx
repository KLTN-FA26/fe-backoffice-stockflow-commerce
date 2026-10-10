import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { ApiError } from "@/lib/api/error";

import { Button } from "@/components/ui/button";

import { INVENTORY_CONTROL_TEXT as text } from "../inventory-control/constants";
import { inventoryPolicyError, isPolicyConflict } from "../inventory-control/edit-errors";
import {
  draftToPolicy,
  inventoryPolicyDraftSchema,
  toInventoryPolicyDraft,
} from "../inventory-control/form-model";
import { useUpdateInventoryControl } from "../inventory-control/mutations";
import { InventoryControlFields } from "./InventoryControlFields";

import type { InventoryPolicyDraft } from "../inventory-control/form-model";
import type { InventoryControlViewModel } from "../inventory-control/view-model";

export function InventoryControlEditor({
  base,
  canEdit,
  onCancel,
  onSaved,
  onReload,
  reload,
}: {
  base: InventoryControlViewModel;
  canEdit: boolean;
  onCancel: () => void;
  onSaved: (value: InventoryControlViewModel) => void;
  onReload: (value: InventoryControlViewModel) => void;
  reload: () => Promise<InventoryControlViewModel>;
}) {
  const form = useForm<InventoryPolicyDraft>({
    resolver: zodResolver(inventoryPolicyDraftSchema),
    defaultValues: toInventoryPolicyDraft(base),
  });
  const mutation = useUpdateInventoryControl(base.context.productId, base.context.variantId);
  const busy = useRef(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [reloading, setReloading] = useState(false);
  const [reloadFailed, setReloadFailed] = useState(false);
  const saving = form.formState.isSubmitting || mutation.isPending;
  async function save(draft: InventoryPolicyDraft) {
    if (busy.current || !canEdit) return;
    busy.current = true;
    setFailure(null);
    try {
      onSaved(
        await mutation.mutateAsync({ ...draftToPolicy(draft), version: base.concurrency.version }),
      );
    } catch (error: unknown) {
      setFailure(error);
      if (error instanceof ApiError && error.fieldErrors) {
        for (const key of Object.keys(inventoryPolicyDraftSchema.shape)) {
          const parsed = inventoryPolicyDraftSchema.keyof().safeParse(key);
          if (parsed.success && error.fieldErrors[key])
            form.setError(parsed.data, { type: "server", message: error.fieldErrors[key] });
        }
      }
    } finally {
      busy.current = false;
    }
  }
  async function reloadBase() {
    if (busy.current) return;
    busy.current = true;
    setReloading(true);
    setReloadFailed(false);
    try {
      const accepted = await reload();
      form.reset(toInventoryPolicyDraft(accepted));
      onReload(accepted);
      setFailure(null);
      mutation.reset();
    } catch {
      setReloadFailed(true);
    } finally {
      busy.current = false;
      setReloading(false);
    }
  }
  return (
    <form
      noValidate
      aria-label={text.editor}
      aria-busy={saving || reloading}
      onSubmit={(event) => {
        void form.handleSubmit(save)(event);
      }}
    >
      <fieldset disabled={saving || reloading || !canEdit} className="min-w-0 space-y-3">
        <InventoryControlFields form={form} />
      </fieldset>
      {failure !== null && (
        <p role="alert" className="text-danger text-sm">
          {inventoryPolicyError(failure)}
        </p>
      )}
      {reloadFailed && (
        <p role="alert" className="text-danger text-sm">
          {text.reloadFailed}
        </p>
      )}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {isPolicyConflict(failure) && (
          <Button
            type="button"
            variant="outline"
            disabled={saving || reloading}
            onClick={() => void reloadBase()}
          >
            {reloading ? text.reloading : text.reload}
          </Button>
        )}
        <Button type="button" variant="outline" disabled={saving || reloading} onClick={onCancel}>
          {text.cancel}
        </Button>
        <Button type="submit" disabled={saving || reloading || !canEdit}>
          {saving ? text.saving : text.save}
        </Button>
      </div>
    </form>
  );
}

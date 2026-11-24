"use client";

/**
 * The state behind the upload-and-check screen: the chosen file (read in the browser), the defaults form, the
 * manufacturer's figures, what blocks a save, and the save itself. The measured figures are read-only: they come
 * from the file, and a save that chooses no new file sends them, and the stored file's area table, as they were read.
 * A save is one request (template and file together, or nothing). What a save without a file may do depends on the
 * stored file (`modelFileStateOf`): free edits of a complete or a file-less configuration; nothing for one without a
 * model or with a broken area ↔ mesh table, until a file is chosen.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { PRINT_CONFIG_SCREEN_LABELS, pendingDesignWarning } from "@/constants/labels-print-config";

import { printConfigErrorMessage } from "../errors";
import { useSavePrintConfig } from "../mutations";
import { changesPrintVersion } from "../print-version";
import { printConfigSaveInputSchema } from "../schemas";
import { editableWithoutFile, modelFileStateOf } from "../selectors";
import { buildSaveInput } from "./save-input";
import { defaultsFor, printDefaultsSchemaFor } from "./print-defaults";
import { saveErrorView } from "./save-error";
import { saveHint } from "./save-hint";
import { sheetOfForm } from "./sheet-of-form";
import { useFileChecks } from "./use-file-checks";
import { useGlbReading } from "./use-glb-reading";

import type { PrintConfigDto, PrintConfigSaveInput } from "../types";
import type { ModelKind, PrintDefaultsValues } from "./print-defaults";
import type { GlbLoader, MeasuredFile } from "./use-glb-reading";

const TEXT = PRINT_CONFIG_SCREEN_LABELS;
const kindOf = (kind: "cup" | "bag"): ModelKind =>
  kind === "cup" ? "parametric-cup" : "parametric-bag";

export interface PrintConfigEditorArgs {
  productId: string;
  variantId: string;
  config: PrintConfigDto | null;
  loadModel?: GlbLoader;
  /** The save stored everything (the page goes back to viewing the stored configuration). */
  onSaved?: () => void;
}

export function usePrintConfigEditor({
  productId,
  variantId,
  config,
  loadModel,
  onSaved,
}: PrintConfigEditorArgs) {
  const reading = useGlbReading(loadModel);
  const save = useSavePrintConfig();
  const result: MeasuredFile | null = reading.phase.status === "done" ? reading.phase.result : null;

  const [formKind, setFormKind] = useState<ModelKind>(config?.model?.kind ?? "parametric-cup");
  const [serverError, setServerError] = useState<string | null>(null);
  /** The save waiting for the person's yes: a save of a stored configuration bumps its version (BD-4). */
  const [asked, setAsked] = useState<PrintConfigSaveInput | null>(null);

  // The kind in play: the file's when one is chosen, else the stored configuration's.
  const kind: ModelKind | null = result
    ? result.kind && kindOf(result.kind)
    : (config?.model?.kind ?? null);
  const storedKind: ModelKind = config?.model?.kind ?? "parametric-cup";
  const model = result ? result.model : (config?.model ?? null);
  const form = useForm<PrintDefaultsValues>({
    resolver: zodResolver(printDefaultsSchemaFor(model, config)),
    defaultValues: defaultsFor(formKind, config),
  });
  // `useWatch` types every field optional: complete it from the starting values.
  const defaults: PrintDefaultsValues = {
    ...defaultsFor(formKind, config),
    ...useWatch({ control: form.control }),
  };
  const { isDirty } = form.formState;

  /** The save stored everything: back to the saved state. */
  function afterStored(saved: PrintConfigDto) {
    reading.clear();
    const savedKind = saved.model?.kind ?? formKind;
    setFormKind(savedKind);
    form.reset(defaultsFor(savedKind, saved));
    onSaved?.();
  }

  const { issues, blockedReason } = useFileChecks(result, defaults);
  const source = result?.model ? { model: result.model, printMeshes: result.parts } : null;
  const sheet = sheetOfForm({ source, stored: config, defaults }); // `null` unless a bag is in play

  const fileState = config ? modelFileStateOf(config) : null;
  const withoutFile = fileState !== null && editableWithoutFile(fileState);
  const fileReady = result !== null && blockedReason === null;
  const isReading = reading.phase.status === "reading";
  const defaultsOnly = result === null && !isReading && isDirty && withoutFile;
  const saving = save.isPending;
  const canSave = !saving && (fileReady || defaultsOnly);

  const hint = saveHint({ saving, fileReady, result, defaultsOnly, fileState, withoutFile });

  /** The form as the stored configuration has it (no other kind's defaults left behind). */
  function backToStored() {
    setFormKind(storedKind);
    form.reset(defaultsFor(storedKind, config));
  }

  /** What the person is about to change invalidates the last error. */
  function clearNotices() {
    setServerError(null);
  }

  async function chooseFile(file: File) {
    clearNotices();
    const read = await reading.choose(file);
    if (!read) {
      if (formKind !== storedKind) backToStored(); // a failed read after a switch of kind
    } else if (read.kind && kindOf(read.kind) !== formKind) {
      // Another kind of product: its own defaults replace the other kind's.
      setFormKind(kindOf(read.kind));
      form.reset(defaultsFor(kindOf(read.kind), config, read.model));
    } else if (
      read.model?.kind === "parametric-bag" &&
      !form.getFieldState("bottomFoldMm").isDirty
    ) {
      // Another bag file: an untyped bottom fold follows its gusset (a stored fold is kept).
      const { bottomFoldMm } = defaultsFor("parametric-bag", config, read.model);
      form.resetField("bottomFoldMm", { defaultValue: bottomFoldMm });
    }
  }

  function discard() {
    clearNotices();
    reading.clear();
    backToStored();
  }

  /** The input of a save, or why there is none; never throws (a throw in `handleSubmit` would reach nobody). */
  function prepare(
    values: PrintDefaultsValues,
  ): { input: PrintConfigSaveInput } | { error: string } {
    try {
      const file = result ? { name: result.fileName, bytes: result.bytes } : undefined;
      const input = buildSaveInput({ source, stored: config, defaults: values, file });
      if (!input) return { error: TEXT.save.fileNeeded };
      // The BE's own rules (file to create, measured values, area ↔ mesh table): a save bound to fail is not sent.
      const checked = printConfigSaveInputSchema.safeParse(input);
      if (!checked.success) {
        return { error: checked.error.issues[0]?.message ?? TEXT.save.failedTitle };
      }
      return { input: checked.data };
    } catch (error: unknown) {
      return { error: printConfigErrorMessage(error) };
    }
  }

  function runSave(input: PrintConfigSaveInput) {
    setAsked(null);
    setServerError(null);
    save.mutate(
      { productId, variantId, input },
      {
        onSuccess: afterStored,
        onError: (error) => {
          // Nothing was stored, or not the measured file (the template is reloaded): the chosen file and the form stay.
          const context = input.stored ? "update" : "create";
          const view = saveErrorView(error, kind, input.config, context);
          setServerError(view.general);
          for (const { field, message } of view.fields) form.setError(field, { message });
        },
      },
    );
  }

  const submit = form.handleSubmit((values) => {
    if (!canSave) return; // Enter in a field submits the form, whatever the button says
    const prepared = prepare(values);
    if ("error" in prepared) {
      setServerError(prepared.error);
      return;
    }
    const { input } = prepared;
    // A stored configuration is asked about first (the dialog adds the pending-designs warning when a print-version field changed and designs are waiting).
    if (input.stored !== null) {
      setAsked(input);
      return;
    }
    runSave(input);
  });

  const savePrompt = asked && {
    warning: pendingDesignWarning("save", {
      hasStored: config !== null && asked.stored !== null,
      pendingReviewCount: config?.pendingReviewCount ?? null,
      // Only a change of a print-version field breaks a pending design (BE `printVersion`); a name does not.
      printVersionChanged:
        config !== null && changesPrintVersion(config, asked.config, asked.file !== undefined),
    }),
    confirm: () => runSave(asked),
    cancel: () => setAsked(null),
  };

  return {
    reading: reading.phase,
    result,
    kind,
    form,
    defaults,
    sheet,
    issues,
    chooseFile,
    discard,
    submit,
    savePrompt,
    saving,
    fileState,
    canSave,
    blockedReason,
    hint,
    serverError,
  };
}

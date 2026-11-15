"use client";

/**
 * The state behind the upload-and-check screen: the chosen file (read in the browser), the defaults form, the
 * manufacturer's figures, what blocks a save, and the save itself. The measured figures are read-only: they come
 * from the file, and a save that chooses no new file re-sends the stored file's checksum (B-6).
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";

import { useSavePrintConfig } from "../mutations";
import { compareWithNominal } from "../model3d/issues";
import { printConfigSaveInputSchema } from "../schemas";
import { fileDifferences, missingFaces } from "./file-differences";
import { buildSaveInput, withDefaults } from "./save-input";
import { parseNominal } from "./nominal";
import { defaultsFor, printDefaultsSchema } from "./print-defaults";
import { saveErrorView } from "./save-error";
import { useGlbReading } from "./use-glb-reading";

import type { ModelIssue } from "../model3d/issues";
import type { PrintConfigDto } from "../types";
import type { NominalKey, NominalText } from "./nominal";
import type { ModelKind, PrintDefaultsValues } from "./print-defaults";
import type { GlbLoader, MeasuredFile } from "./use-glb-reading";

const TEXT = PRINT_CONFIG_SCREEN_LABELS;
const resolver = zodResolver(printDefaultsSchema);
const kindOf = (kind: "cup" | "bag"): ModelKind =>
  kind === "cup" ? "parametric-cup" : "parametric-bag";

export interface PrintConfigEditorArgs {
  productId: string;
  variantId: string;
  config: PrintConfigDto | null;
  loadModel?: GlbLoader;
}

export function usePrintConfigEditor({
  productId,
  variantId,
  config,
  loadModel,
}: PrintConfigEditorArgs) {
  const reading = useGlbReading(loadModel);
  const save = useSavePrintConfig();
  const result: MeasuredFile | null = reading.phase.status === "done" ? reading.phase.result : null;

  const [formKind, setFormKind] = useState<ModelKind>(config?.model?.kind ?? "parametric-cup");
  const [nominalText, setNominalText] = useState<NominalText>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // The kind in play: the file's when one is chosen, else the stored configuration's.
  const kind: ModelKind | null = result
    ? result.kind && kindOf(result.kind)
    : (config?.model?.kind ?? null);
  const storedKind: ModelKind = config?.model?.kind ?? "parametric-cup";
  const form = useForm<PrintDefaultsValues>({
    resolver,
    defaultValues: defaultsFor(formKind, config),
  });
  // `useWatch` types every field optional; the form is always filled, so complete it from the starting values.
  const watched = useWatch({ control: form.control });
  const defaults: PrintDefaultsValues = { ...defaultsFor(formKind, config), ...watched };
  const { isDirty } = form.formState;

  const { nominal, invalid } = useMemo(() => parseNominal(nominalText), [nominalText]);
  const nominalIssues: ModelIssue[] = useMemo(
    () => (result?.model ? compareWithNominal(result.model, nominal) : []),
    [result, nominal],
  );
  // The file against the model that will be saved (the defaults applied), and the faces a bag still lacks.
  const issues: ModelIssue[] = result
    ? [
        ...result.issues,
        ...nominalIssues,
        ...missingFaces(result.model, result.parts),
        ...(result.model
          ? fileDifferences(withDefaults(result.model, defaults), result.parts)
          : []),
      ]
    : [];

  const storedFile = Boolean(config?.model && config.model3d);
  const blockedReason = !result
    ? null
    : issues.some((issue) => issue.level === "error")
      ? TEXT.issues.blockedByErrors
      : result.model === null
        ? TEXT.issues.bagIncomplete
        : null;
  const fileReady = result !== null && blockedReason === null;
  const isReading = reading.phase.status === "reading";
  const defaultsOnly = result === null && !isReading && isDirty && storedFile;
  const canSave = !save.isPending && (fileReady || defaultsOnly);

  const hint = save.isPending
    ? null
    : fileReady && result
      ? TEXT.save.newFile(result.fileName)
      : defaultsOnly
        ? TEXT.save.defaultsOnly
        : result === null
          ? TEXT.save.nothingToSave
          : null;

  /** The form as the stored configuration has it: its kind and its defaults (no other kind's left behind). */
  function backToStored() {
    setFormKind(storedKind);
    form.reset(defaultsFor(storedKind, config));
  }

  async function chooseFile(file: File) {
    setServerError(null);
    setNominalText({});
    const read = await reading.choose(file);
    if (!read) {
      if (formKind !== storedKind) backToStored(); // a failed read after a switch of kind
    } else if (read.kind && kindOf(read.kind) !== formKind) {
      // Another kind of product: its own defaults replace the other kind's.
      setFormKind(kindOf(read.kind));
      form.reset(defaultsFor(kindOf(read.kind), config));
    }
  }

  function discard() {
    setServerError(null);
    setNominalText({});
    reading.clear();
    backToStored();
  }

  const submit = form.handleSubmit((values) => {
    if (!canSave) return; // Enter in a field submits the form, whatever the button says
    const source = result?.model ? { model: result.model, printMeshes: result.parts } : null;
    const file = result ? { name: result.fileName, bytes: result.bytes } : undefined;
    const input = buildSaveInput({ source, stored: config, defaults: values, file });
    if (!input) return;
    const checked = printConfigSaveInputSchema.safeParse(input);
    if (!checked.success) {
      setServerError(checked.error.issues[0]?.message ?? TEXT.save.failedTitle);
      return;
    }
    setServerError(null);
    save.mutate(
      { productId, variantId, input: checked.data },
      {
        onSuccess: (saved) => {
          reading.clear();
          setNominalText({});
          const savedKind = saved.model?.kind ?? formKind;
          setFormKind(savedKind);
          form.reset(defaultsFor(savedKind, saved));
        },
        onError: (error) => {
          const view = saveErrorView(error, kind);
          setServerError(view.general);
          for (const { field, message } of view.fields) form.setError(field, { message });
        },
      },
    );
  });

  return {
    reading: reading.phase,
    result,
    kind,
    form,
    defaults,
    issues,
    nominalText,
    nominalInvalid: invalid,
    setNominal: (key: NominalKey, text: string) => setNominalText((t) => ({ ...t, [key]: text })),
    chooseFile,
    discard,
    submit,
    saving: save.isPending,
    canSave,
    blockedReason,
    hint,
    serverError,
  };
}

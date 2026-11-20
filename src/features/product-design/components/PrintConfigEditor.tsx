"use client";

import { Box, FileBox } from "lucide-react";
import { useId, useState } from "react";

import {
  PRINT_CONFIG_ACTION_LABELS,
  PRINT_CONFIG_SCREEN_LABELS,
} from "@/constants/labels-print-config";
import { cn } from "cn";
import { Alert } from "@/components/shared/Alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DETAIL_CARD_CLASS, DetailSection } from "@/components/shared/DetailSection";

import { BagSheetPreview } from "./BagSheetPreview";
import { ModelFilePicker } from "./ModelFilePicker";
import { ModelFileStateNotice } from "./ModelFileStateNotice";
import { ModelIssueList } from "./ModelIssueList";
import { ModelReadReport } from "./ModelReadReport";
import { ModelViewSlot } from "./ModelViewSlot";
import { NominalInputs } from "./NominalInputs";
import { FileRulesForm } from "./FileRulesForm";
import { ModelFileChecklist } from "./PrintConfigEmpty";
import { PrintConfigSaveAlerts, PrintConfigSaveButton } from "./PrintConfigSaveBar";
import { PrintConfigSummary } from "./PrintConfigSummary";
import { PrintConfigWorkbench } from "./PrintConfigWorkbench";
import { PrintDefaultsForm } from "./PrintDefaultsForm";
import { usePrintConfigEditor } from "./use-print-config-editor";

import type { ReactNode } from "react";
import type { ChosenFile } from "./ChosenModelFile";
import type { PrintConfigEditorArgs } from "./use-print-config-editor";
import type { ReadPhase } from "./use-glb-reading";

const TEXT = PRINT_CONFIG_SCREEN_LABELS;

export interface PrintConfigEditorProps extends PrintConfigEditorArgs {
  /** The page band (`PrintConfigHeader`), given the save button and the save's alerts to show in it. */
  header: (save: { button: ReactNode; alerts: ReactNode }) => ReactNode;
}

/** The file of the row: the reading phase, with the size the browser gave when it was chosen. */
function chosenOf(phase: ReadPhase, size: number | null): ChosenFile | null {
  if (phase.status === "idle") return null;
  if (phase.status === "done") {
    return { name: phase.result.fileName, size: phase.result.bytes.byteLength, state: "read" };
  }
  return { name: phase.fileName, size, state: phase.status };
}

/** The view column before any file is chosen for a variant with no saved configuration: where the model will appear. */
function ViewWaiting() {
  return (
    <section
      aria-label={TEXT.cards.view}
      className={cn(
        DETAIL_CARD_CLASS,
        "flex min-h-64 flex-col items-center justify-center gap-2 text-center",
      )}
    >
      <Box aria-hidden className="text-ink-tertiary size-5" />
      <p className="text-ink-secondary max-w-[48ch] text-[0.8125rem]">{TEXT.cards.viewEmpty}</p>
    </section>
  );
}

/**
 * Choose a `.glb`, see what was read and what is wrong next to the model, confirm the defaults, save. Mounted only for
 * who may edit. It lays out the page under the band: the file work on the left, the model on the right (the saved
 * configuration takes that place while no file is chosen), the defaults and the saved configuration under the work.
 * The band and the work are one `<form>`: the save in the band is its submit button.
 */
export function PrintConfigEditor({ header, ...args }: PrintConfigEditorProps) {
  const editor = usePrintConfigEditor(args);
  const formId = useId();
  const [chosenSize, setChosenSize] = useState<number | null>(null);
  const { reading, result, form, saving } = editor;
  const busy = reading.status === "reading" || saving;
  const saved = args.config;

  const file = (
    <DetailSection title={TEXT.cards.file} icon={FileBox}>
      <div className="space-y-4">
        {saved === null && <ModelFileChecklist />}
        {result === null && <ModelFileStateNotice state={editor.fileState} />}
        <ModelFilePicker
          busy={busy}
          replacing={saved !== null}
          chosen={chosenOf(reading, chosenSize)}
          onFile={(chosen) => {
            setChosenSize(chosen.size);
            void editor.chooseFile(chosen);
          }}
          onDiscard={editor.discard}
        />
        {reading.status === "unreadable" && (
          <div role="alert">
            <Alert tone="danger" title={TEXT.unreadableTitle}>
              {reading.reason}
            </Alert>
          </div>
        )}
        {result && (
          <>
            <ModelIssueList issues={editor.issues} />
            <ModelReadReport result={result} defaults={editor.defaults} />
            {result.model && (
              <NominalInputs
                kind={result.kind === "bag" ? "bag" : "cup"}
                values={editor.nominalText}
                invalid={editor.nominalInvalid}
                disabled={saving}
                onChange={editor.setNominal}
              />
            )}
          </>
        )}
      </div>
    </DetailSection>
  );

  const view = result ? (
    <DetailSection title={TEXT.cards.view} icon={Box}>
      <ModelViewSlot result={result} issues={editor.issues} defaults={editor.defaults} />
    </DetailSection>
  ) : saved ? (
    <PrintConfigSummary config={saved} />
  ) : (
    <ViewWaiting />
  );

  const rest = (
    <>
      {editor.kind && (
        <FileRulesForm
          register={form.register}
          control={form.control}
          errors={form.formState.errors}
          disabled={saving}
        />
      )}
      {editor.kind && (
        <PrintDefaultsForm
          kind={editor.kind}
          register={form.register}
          control={form.control}
          errors={form.formState.errors}
          disabled={saving}
          preview={
            editor.kind === "parametric-bag" ? <BagSheetPreview sheet={editor.sheet} /> : undefined
          }
        />
      )}
      {result && saved && <PrintConfigSummary config={saved} defaultOpen={false} />}
    </>
  );

  // The band is inside the form, so the save is the form's own submit button (Enter in a field submits it); the band's
  // other buttons (activate, stop) are `type="button"` and their dialog is portalled out of the form.
  return (
    <form id={formId} className="space-y-5" noValidate onSubmit={editor.submit}>
      {header({
        button: (
          <PrintConfigSaveButton
            formId={formId}
            canSave={editor.canSave}
            saving={saving}
            hint={editor.hint}
          />
        ),
        // Only when there is something to say: an empty row would still add the band's gap.
        alerts:
          editor.blockedReason || editor.serverError ? (
            <PrintConfigSaveAlerts
              blockedReason={editor.blockedReason}
              error={editor.serverError}
            />
          ) : null,
      })}
      <PrintConfigWorkbench file={file} view={view} rest={rest} />
      <ConfirmDialog
        open={editor.savePrompt !== null}
        onOpenChange={(open) => !open && editor.savePrompt?.cancel()}
        title={TEXT.save.confirmTitle}
        description={TEXT.save.confirmDescription}
        confirmLabel={PRINT_CONFIG_ACTION_LABELS.save}
        variant="default"
        onConfirm={() => editor.savePrompt?.confirm()}
      >
        {editor.savePrompt?.warning && <Alert tone="warning">{editor.savePrompt.warning}</Alert>}
      </ConfirmDialog>
    </form>
  );
}

"use client";

import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import { ModelFileDropzone } from "./ModelFileDropzone";
import { ModelIssueList } from "./ModelIssueList";
import { ModelReadReport } from "./ModelReadReport";
import { ModelViewSlot } from "./ModelViewSlot";
import { NominalInputs } from "./NominalInputs";
import { PrintConfigSaveBar } from "./PrintConfigSaveBar";
import { PrintDefaultsForm } from "./PrintDefaultsForm";
import { usePrintConfigEditor } from "./use-print-config-editor";

import type { PrintConfigEditorArgs } from "./use-print-config-editor";

const TEXT = PRINT_CONFIG_SCREEN_LABELS;

/** Choose a `.glb`, see what was read and what is wrong, confirm the defaults, save. Mounted only for who may edit. */
export function PrintConfigEditor(args: PrintConfigEditorArgs) {
  const editor = usePrintConfigEditor(args);
  const { reading, result, form, saving } = editor;
  const busy = reading.status === "reading" || saving;

  return (
    <form className="space-y-4" noValidate onSubmit={editor.submit}>
      <ModelFileDropzone
        busy={busy}
        replacing={args.config !== null || result !== null}
        onFile={(file) => void editor.chooseFile(file)}
      />
      {reading.status === "reading" && (
        <p role="status" className="text-ink-secondary text-[0.8125rem]">
          {TEXT.dropzone.reading(reading.fileName)}
        </p>
      )}
      {reading.status === "unreadable" && (
        <div role="alert">
          <Alert tone="danger" title={TEXT.unreadableTitle}>
            {reading.reason}
          </Alert>
        </div>
      )}
      {(result || reading.status === "unreadable") && (
        <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={editor.discard}>
          {TEXT.discard}
        </Button>
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

      <ModelViewSlot result={result} issues={editor.issues} defaults={editor.defaults} />

      {editor.kind && (
        <PrintDefaultsForm
          kind={editor.kind}
          register={form.register}
          control={form.control}
          errors={form.formState.errors}
          disabled={saving}
        />
      )}

      <PrintConfigSaveBar
        canSave={editor.canSave}
        saving={saving}
        blockedReason={editor.blockedReason}
        hint={editor.hint}
        error={editor.serverError}
        onSave={() => void editor.submit()}
      />
    </form>
  );
}

import { FileBox } from "lucide-react";

import { MODEL3D_FILE_CHECKLIST } from "@/constants/labels-model3d";
import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { DETAIL_CARD_CLASS } from "@/components/shared/DetailSection";
import { EmptyState } from "@/components/shared/EmptyState";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.empty;

/** No configuration yet, for a read-only viewer: they only learn there is none. */
export function PrintConfigEmpty() {
  return (
    <section className={DETAIL_CARD_CLASS}>
      <EmptyState icon={<FileBox className="size-8" />} title={TEXT.readOnly} className="py-8" />
    </section>
  );
}

/**
 * No configuration yet, for who may create it: what to upload, and how the file must be built (the 7 lines of the
 * convention). Shown above the file chooser.
 */
export function ModelFileChecklist() {
  return (
    <div className="space-y-3">
      <p className="text-ink-secondary max-w-[68ch] text-[0.8125rem]">{TEXT.description}</p>
      <div className="border-border-default bg-bg-subtle rounded-[var(--card-radius)] border p-[var(--card-pad)]">
        <h4 className="text-ink-primary text-sm font-semibold">{TEXT.checklistTitle}</h4>
        <ol className="text-ink-secondary mt-2 list-decimal space-y-1 pl-5 text-[0.8125rem]">
          {MODEL3D_FILE_CHECKLIST.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

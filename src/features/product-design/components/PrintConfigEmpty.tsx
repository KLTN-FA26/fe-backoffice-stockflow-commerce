import { FileBox } from "lucide-react";

import { MODEL3D_FILE_CHECKLIST } from "@/constants/labels-model3d";
import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { EmptyState } from "@/components/shared/EmptyState";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.empty;

/**
 * No configuration yet. A person who can edit is told what to upload and how the file must be built (the 7 lines of
 * the convention); a read-only viewer only learns there is none.
 */
export function PrintConfigEmpty({ canEdit }: { canEdit: boolean }) {
  if (!canEdit) return <EmptyState icon={<FileBox className="size-8" />} title={TEXT.readOnly} />;
  return (
    <div className="space-y-3">
      <EmptyState
        icon={<FileBox className="size-8" />}
        title={TEXT.title}
        description={TEXT.description}
        className="py-8"
      />
      <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
        <h4 className="text-ink-primary text-sm font-semibold">{TEXT.checklistTitle}</h4>
        <ol className="text-ink-secondary mt-2 list-decimal space-y-1 pl-5 text-[0.8125rem]">
          {MODEL3D_FILE_CHECKLIST.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}

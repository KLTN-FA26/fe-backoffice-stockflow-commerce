import { FileBox } from "lucide-react";

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
 * No configuration yet, for who may create it: one line on what to upload, above the file chooser. The way the file is
 * built (Blender units, axes, `print:*` names…) is known to the staff who prepare it, so it is not repeated here; a file
 * that breaks it is still refused by the file checks.
 */
export function ModelFileChecklist() {
  return <p className="text-ink-secondary max-w-[68ch] text-[0.8125rem]">{TEXT.description}</p>;
}

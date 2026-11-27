import { Save } from "lucide-react";
import { cn } from "cn";

import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { DetailSection } from "@/components/shared/DetailSection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { figureRows, hasModel } from "../selectors";
import { defaultRows } from "./default-rows";
import { formatMm } from "./format-mm";
import { ModelFileLink } from "./ModelFileLink";
import { defaultsFor } from "./print-defaults";
import { ruleRows } from "./saved-values";
import { ValueTable } from "./ValueTable";

import type { PrintConfigDto } from "../types";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.summary;

/**
 * "Cấu hình đang lưu": the saved print configuration, read-only: kind, the stored file (link and SHA-256: after a save,
 * the proof it was uploaded), measured figures, the values the file cannot tell, the file rules, print areas. In the
 * edit mode (`editing`) the values that are being edited (the ones the file cannot tell, the file rules) are left out:
 * each field of the form says its stored value under it when changed, so the page never shows them twice.
 */
export function PrintConfigSummary({
  config,
  editing = false,
}: {
  config: PrintConfigDto;
  /** Shown beside the edit form: only what the form does not edit (the file, its measures, the print areas). */
  editing?: boolean;
}) {
  const { model } = config;
  const stored = model ? defaultsFor(model.kind, config) : null;
  return (
    <DetailSection title={PRINT_CONFIG_SCREEN_LABELS.cards.saved} icon={Save}>
      {/* Sized by its column, not by the screen: the card sits in the wide view column or under the narrow work one. */}
      <div className="@container space-y-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[0.8125rem]">
          <dt className="text-ink-secondary">{TEXT.kind}</dt>
          <dd className="text-ink-primary">
            {model
              ? PRINT_CONFIG_SCREEN_LABELS.kinds[model.kind === "parametric-cup" ? "cup" : "bag"]
              : TEXT.noModel}
          </dd>
          <dt className="text-ink-secondary">{TEXT.file}</dt>
          <dd className="text-ink-primary">
            {hasModel(config) ? TEXT.fileAttached : TEXT.fileMissing}
            {hasModel(config) && <ModelFileLink config={config} />}
          </dd>
        </dl>

        {model && stored && (
          <div
            className={cn("grid items-start gap-3 @xl:grid-cols-2", !editing && "@5xl:grid-cols-3")}
          >
            <ValueTable
              caption={TEXT.measuredTitle}
              rows={figureRows(model).map(({ label, value }) => ({
                label,
                value: formatMm(value),
              }))}
            />
            {!editing && (
              <ValueTable caption={TEXT.defaultsTitle} rows={defaultRows(model.kind, stored)} />
            )}
            {!editing && <ValueTable caption={TEXT.rulesTitle} rows={ruleRows(stored)} />}
          </div>
        )}

        <Table>
          <caption className="text-ink-primary pb-2 text-left text-sm font-semibold">
            {TEXT.areasTitle}
          </caption>
          <TableHeader>
            <TableRow>
              <TableHead>{TEXT.areaColumns.area}</TableHead>
              <TableHead>{TEXT.areaColumns.size}</TableHead>
              <TableHead>{TEXT.areaColumns.safeMargin}</TableHead>
              <TableHead>{TEXT.areaColumns.bleed}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {config.printAreas.map((area) => (
              <TableRow key={area.code}>
                <TableCell className="text-ink-primary">{area.name}</TableCell>
                <TableCell className="tabular-nums">
                  {PRINT_CONFIG_SCREEN_LABELS.report.faceSize(
                    formatMm(area.widthMm),
                    formatMm(area.heightMm),
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{formatMm(area.safeMarginMm)}</TableCell>
                <TableCell className="tabular-nums">{formatMm(area.bleedMm)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DetailSection>
  );
}

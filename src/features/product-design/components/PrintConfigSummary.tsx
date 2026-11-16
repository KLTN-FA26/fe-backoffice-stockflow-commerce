import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
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
import { ValueTable } from "./ValueTable";

import type { PrintConfigDto } from "../types";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.summary;

/** The saved print configuration, read-only: kind, measured figures, defaults, print areas, whether a 3D file is attached. */
export function PrintConfigSummary({ config }: { config: PrintConfigDto }) {
  const { model } = config;
  return (
    <div className="space-y-3">
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

      {model && (
        <div className="grid gap-3 lg:grid-cols-2">
          <ValueTable
            caption={TEXT.measuredTitle}
            rows={figureRows(model).map(({ label, value }) => ({ label, value: formatMm(value) }))}
          />
          <ValueTable
            caption={TEXT.defaultsTitle}
            rows={defaultRows(model.kind, defaultsFor(model.kind, config))}
          />
        </div>
      )}

      <div className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-[var(--card-shadow)]">
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
    </div>
  );
}

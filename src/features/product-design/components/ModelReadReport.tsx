import { MODEL3D_TEMPLATE_LABELS } from "@/constants/labels-model3d";
import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { figureRows } from "../selectors";
import { formatMm } from "./format-mm";
import { ValueTable } from "./ValueTable";

import type { PrintAreaCode } from "../model3d/model-types";
import type { MeasuredFile, PrintPart } from "./use-glb-reading";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.report;

const partName = (code: PrintAreaCode) =>
  code === "BODY" ? MODEL3D_TEMPLATE_LABELS.cupBody : MODEL3D_TEMPLATE_LABELS.faces[code];

function partSize({ shape }: PrintPart): string {
  if (shape === null) return TEXT.unreadSize;
  if (shape.kind === "band") {
    return TEXT.bandSize(
      formatMm(shape.topDiameterMm),
      formatMm(shape.bottomDiameterMm),
      formatMm(shape.topYMm - shape.bottomYMm),
    );
  }
  return TEXT.faceSize(formatMm(shape.widthMm), formatMm(shape.heightMm));
}

/**
 * What was read from the file: the kind, the figures it gave (read-only: never typed by hand) and each print part
 * with its size. A bag that could not be sized as a whole has no figures but still shows the size of every face. The
 * values the file cannot tell are not repeated here: they are the form "Số không lấy từ file 3D" right below.
 */
export function ModelReadReport({ result }: { result: MeasuredFile }) {
  const kind = result.kind === null ? null : PRINT_CONFIG_SCREEN_LABELS.kinds[result.kind];
  return (
    <section aria-labelledby="print-config-report" className="space-y-3">
      <div>
        <h3 id="print-config-report" className="text-ink-primary text-sm font-semibold">
          {kind === null ? TEXT.unknownKind : TEXT.recognized(kind)}
        </h3>
        <p className="text-ink-tertiary text-xs">{TEXT.fileName(result.fileName)}</p>
      </div>

      {result.model !== null && (
        <ValueTable
          caption={TEXT.measuredTitle}
          rows={figureRows(result.model).map(({ label, value }) => ({
            label,
            value: formatMm(value),
          }))}
        />
      )}

      {result.parts.length > 0 && (
        <div className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-[var(--card-shadow)]">
          <Table>
            <caption className="text-ink-primary pb-2 text-left text-sm font-semibold">
              {TEXT.partsTitle}
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>{TEXT.partColumns.part}</TableHead>
                <TableHead>{TEXT.partColumns.name}</TableHead>
                <TableHead>{TEXT.partColumns.size}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.parts.map((part, index) => (
                <TableRow key={`${index}-${part.printAreaCode}-${part.meshName}`}>
                  <TableCell className="text-ink-primary">{partName(part.printAreaCode)}</TableCell>
                  <TableCell className="text-ink-secondary font-mono">{part.meshName}</TableCell>
                  {/* The size is a sentence ("Miệng …, đáy …, cao …"): it wraps in the narrow work column instead of
                      the table scrolling sideways (shadcn cells are `whitespace-nowrap`). */}
                  <TableCell className="text-ink-primary whitespace-normal tabular-nums">
                    {partSize(part)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

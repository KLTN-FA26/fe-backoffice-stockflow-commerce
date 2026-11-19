import { MODEL3D_TEMPLATE_LABELS } from "@/constants/labels-model3d";
import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";

import { BAG_SHEET_SIDES } from "../bag-sheet";
import { formatMm } from "./format-mm";

import type { BagSheet } from "../bag-sheet";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.bagSheet;
const FACES = MODEL3D_TEMPLATE_LABELS.faces;
const size = (width: number, height: number) => TEXT.size(formatMm(width), formatMm(height));

/** The sheet drawn in millimetres (the SVG's own unit): bleed box, unprinted bands, the four sides, folds, die line. */
function SheetDrawing({ sheet }: { sheet: BagSheet }) {
  const b = sheet.bleedMm;
  const { trimWidthMm: w, trimHeightMm: h, topFoldMm: T, printedHeightMm: P } = sheet;
  const label = Math.min(P, sheet.gussetMm) * 0.16;
  return (
    <svg
      role="img"
      aria-label={TEXT.figure(size(w, h), size(sheet.bleedWidthMm, sheet.bleedHeightMm))}
      viewBox={`0 0 ${sheet.bleedWidthMm} ${sheet.bleedHeightMm}`}
      className="h-auto w-full"
    >
      <rect width={sheet.bleedWidthMm} height={sheet.bleedHeightMm} className="fill-bg-subtle" />
      <g transform={`translate(${b} ${b})`}>
        <rect width={w} height={h} className="fill-bg-muted" />
        {BAG_SHEET_SIDES.map((code) => {
          const r = sheet.sides[code];
          return (
            <g key={code}>
              <rect x={r.x} y={r.y} width={r.width} height={r.height} className="fill-bg-surface" />
              <text
                x={r.x + r.width / 2}
                y={T + P / 2}
                fontSize={label}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-ink-secondary"
              >
                {FACES[code]}
              </text>
            </g>
          );
        })}
        <g className="stroke-dot-info" strokeDasharray="4 3" vectorEffect="non-scaling-stroke">
          {sheet.verticalFolds.map((x, i) => (
            <line key={`v${i}`} x1={x} y1={0} x2={x} y2={h} vectorEffect="non-scaling-stroke" />
          ))}
          {sheet.horizontalFolds.map((y, i) => (
            <line key={`h${i}`} x1={0} y1={y} x2={w} y2={y} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
        <rect
          width={w}
          height={h}
          fill="none"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          className="stroke-ink-primary"
        />
      </g>
    </svg>
  );
}

/**
 * The bag's print file as one flat sheet (glue flap, four sides, top and bottom folds), redrawn from the form as the
 * person types, with its sizes in mm. `null`: a figure is half-typed, nothing to draw.
 */
export function BagSheetPreview({ sheet }: { sheet: BagSheet | null }) {
  return (
    <section
      aria-labelledby="bag-sheet-title"
      className="border-border-default bg-bg-surface space-y-3 rounded-(--card-radius) border p-4 shadow-(--card-shadow)"
    >
      <div>
        <h3 id="bag-sheet-title" className="text-ink-primary text-sm font-semibold">
          {TEXT.title}
        </h3>
        <p className="text-ink-secondary text-xs">{TEXT.description}</p>
      </div>
      {sheet === null ? (
        <p className="text-ink-tertiary text-[0.8125rem]">{TEXT.unusable}</p>
      ) : (
        <>
          <SheetDrawing sheet={sheet} />
          <dl className="grid gap-x-4 gap-y-1 text-[0.8125rem] sm:grid-cols-[auto_1fr]">
            <dt className="text-ink-secondary">{TEXT.trim}</dt>
            <dd className="text-ink-primary tabular-nums">
              {size(sheet.trimWidthMm, sheet.trimHeightMm)}
            </dd>
            <dt className="text-ink-secondary">{TEXT.bleedBox}</dt>
            <dd className="text-ink-primary tabular-nums">
              {size(sheet.bleedWidthMm, sheet.bleedHeightMm)}
            </dd>
            <dt className="text-ink-secondary">{TEXT.columns}</dt>
            <dd className="text-ink-primary tabular-nums">
              {[TEXT.glueFlap, ...BAG_SHEET_SIDES.map((code) => FACES[code])]
                .map((name, i) => TEXT.part(name, formatMm(sheet.columnsMm[i] ?? 0)))
                .join(" · ")}
            </dd>
            <dt className="text-ink-secondary">{TEXT.rows}</dt>
            <dd className="text-ink-primary tabular-nums">
              {[TEXT.topFold, TEXT.printed, TEXT.bottomFold]
                .map((name, i) => TEXT.part(name, formatMm(sheet.rowsMm[i] ?? 0)))
                .join(" · ")}
            </dd>
          </dl>
        </>
      )}
      <p className="text-ink-tertiary text-xs">{TEXT.assumption}</p>
    </section>
  );
}

import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

import type { ValueRow } from "./default-rows";

/** A titled two-column table of label / value rows; values are numbers, so they align (`tabular-nums`). */
export function ValueTable({
  caption,
  note,
  rows,
}: {
  caption: string;
  note?: string;
  rows: readonly ValueRow[];
}) {
  return (
    <div className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-[var(--card-shadow)]">
      {note && <p className="text-ink-secondary pb-2 text-[0.8125rem]">{note}</p>}
      <Table>
        <caption className="text-ink-primary pb-2 text-left text-sm font-semibold">
          {caption}
        </caption>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell className="text-ink-secondary">{row.label}</TableCell>
              <TableCell className="text-ink-primary text-right tabular-nums">
                {row.value}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

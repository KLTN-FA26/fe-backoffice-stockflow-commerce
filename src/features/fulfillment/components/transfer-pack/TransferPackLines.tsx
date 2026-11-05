"use client";

import { Boxes } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

import { MONO, Section } from "../primitives";

import type {
  TransferPackLine,
  TransferPackSession,
} from "@/features/fulfillment/transfer-pack-types";

const L = UI_LABELS.transferPack.lines;
const TH = "text-ink-secondary px-3 py-2 text-xs font-medium";
const TD = "px-3 py-2 text-[0.8125rem]";

function Tag({ children }: { children: string }) {
  return (
    <span className="border-border-default text-ink-secondary rounded-[var(--r-sm)] border px-1.5 py-0.5 text-[0.6875rem]">
      {children}
    </span>
  );
}

function LineRow({
  line,
  onOpenKit,
}: {
  line: TransferPackLine;
  /** Có = người dùng đóng bộ được (phiên đang đóng, đúng người). */
  onOpenKit?: (transferLineId: string) => void;
}) {
  return (
    <tr className="border-border-default border-b last:border-b-0">
      <td className={`${TD} text-ink-secondary ${MONO}`}>{line.lineNo}</td>
      <td className={`${TD} text-ink-primary`}>
        <div className={`font-medium ${MONO}`}>{line.sku}</div>
        {line.kitSuggested && (
          <div className="mt-1">
            <Tag>{L.kitSuggested}</Tag>
          </div>
        )}
      </td>
      <td className={`${TD} text-ink-secondary ${MONO}`}>{line.barcode ?? "—"}</td>
      <td className={`${TD} text-ink-secondary ${MONO}`}>{line.lotNumber ?? "—"}</td>
      <td className={`${TD} text-right ${MONO}`}>{line.requested}</td>
      <td className={`${TD} text-right ${MONO}`}>{line.packed}</td>
      <td
        className={`${TD} text-right ${MONO} ${line.remaining === 0 ? "text-positive" : "text-ink-primary font-medium"}`}
      >
        {line.remaining === 0 ? L.done : line.remaining}
      </td>
      <td className={`${TD} text-right ${MONO}`}>{line.packageCount}</td>
      <td className={`${TD} text-right`}>
        {onOpenKit && line.packageCount > 1 && line.remaining > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onOpenKit(line.transferLineId)}
            aria-label={`${L.openKit} ${line.sku}`}
          >
            <Boxes className="size-3.5" /> {UI_LABELS.transferPack.action.openKit}
          </Button>
        )}
      </td>
    </tr>
  );
}

/** Dòng hàng của lệnh chuyển kho: số yêu cầu, đã đóng vào kiện, còn lại và số thùng của một đơn vị (đóng bộ). */
export function TransferPackLines({
  session,
  onOpenKit,
}: {
  session: TransferPackSession;
  onOpenKit?: (transferLineId: string) => void;
}) {
  return (
    <Section title={L.title} description={L.description}>
      <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
        <table className="w-full min-w-[44rem]">
          <caption className="sr-only">{L.title}</caption>
          <thead className="bg-bg-subtle border-border-default border-b">
            <tr>
              <th scope="col" className={`${TH} text-left`}>
                #
              </th>
              <th scope="col" className={`${TH} text-left`}>
                {L.sku}
              </th>
              <th scope="col" className={`${TH} text-left`}>
                {L.barcode}
              </th>
              <th scope="col" className={`${TH} text-left`}>
                {L.lot}
              </th>
              <th scope="col" className={`${TH} text-right`}>
                {L.requested}
              </th>
              <th scope="col" className={`${TH} text-right`}>
                {L.packed}
              </th>
              <th scope="col" className={`${TH} text-right`}>
                {L.remaining}
              </th>
              <th scope="col" className={`${TH} text-right`}>
                {L.boxesPerUnit}
              </th>
              <th scope="col" className={TH} />
            </tr>
          </thead>
          <tbody>
            {session.lines.map((line) => (
              <LineRow key={line.transferLineId} line={line} onOpenKit={onOpenKit} />
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

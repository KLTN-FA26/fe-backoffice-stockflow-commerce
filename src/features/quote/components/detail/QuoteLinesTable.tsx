"use client";

import Link from "next/link";
import { CircleAlert, CircleCheck, Repeat } from "lucide-react";

import { formatMoney } from "@/lib/format/money";
import { formatNumber } from "@/lib/format/number";

import { MONO } from "../copy";

import type { ReactNode } from "react";
import type { QuoteLine } from "@/features/quote/types";

function SampleState({ line }: { line: QuoteLine }) {
  if (line.sample.reorder)
    return (
      <span className="text-info inline-flex items-center gap-1">
        <Repeat className="size-3.5" aria-hidden="true" /> In lại thiết kế cũ
      </span>
    );
  if (line.sample.satisfied)
    return (
      <span className="text-positive inline-flex items-center gap-1">
        <CircleCheck className="size-3.5" aria-hidden="true" /> Mẫu đã duyệt
      </span>
    );
  return (
    <span className="text-warning inline-flex items-center gap-1">
      <CircleAlert className="size-3.5" aria-hidden="true" /> Cần duyệt mẫu
    </span>
  );
}

/**
 * Dòng báo giá — số liệu (bậc giá, đơn giá đề xuất / đã chấp nhận) đọc nguyên từ BE; FE không tự
 * tính giá. `sampleAction` cho phép màn back-office gắn nút "Tạo yêu cầu mẫu" theo dòng.
 */
export function QuoteLinesTable({
  lines,
  currency = "VND",
  sampleAction,
}: {
  lines: QuoteLine[];
  currency?: string;
  sampleAction?: (line: QuoteLine) => ReactNode;
}) {
  return (
    <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
      <table className="w-full min-w-[860px] text-[0.8125rem]">
        <caption className="sr-only">Các dòng của báo giá</caption>
        <thead className="bg-bg-subtle text-ink-secondary text-left">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              #
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Phôi / thiết kế
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              SL (cái)
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Bậc giá (từ SL → đơn giá)
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Đơn giá
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Thành tiền
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Mẫu
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const accepted = line.acceptedUnitPrice != null;
            const unit = accepted ? line.acceptedUnitPrice : line.proposedUnitPrice;
            const total = accepted ? line.acceptedLineTotal : line.proposedLineTotal;
            const qty = line.acceptedQuantity ?? line.quantity;
            return (
              <tr key={line.id} className="border-border-default border-t align-top">
                <td className={`px-3 py-2 ${MONO}`}>{line.lineNo}</td>
                <td className="px-3 py-2">
                  <div className={`text-ink-primary font-medium ${MONO}`}>{line.blankSku}</div>
                  <div className={`text-ink-tertiary ${MONO}`} title={line.designSnapshotId}>
                    TK {line.designSnapshotId.slice(0, 8)}
                  </div>
                  {line.printSpec && (
                    <div className="text-ink-secondary mt-1 max-w-[36ch] whitespace-pre-line">
                      {line.printSpec}
                    </div>
                  )}
                </td>
                <td className={`px-3 py-2 text-right ${MONO}`}>
                  {formatNumber(qty)}
                  {line.acceptedQuantity != null && line.acceptedQuantity !== line.quantity && (
                    <div className="text-ink-tertiary">đề xuất {formatNumber(line.quantity)}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {line.priced ? (
                    <ul className={`space-y-0.5 ${MONO}`}>
                      {line.tiers.map((tier) => (
                        <li key={tier.minQuantity}>
                          ≥ {formatNumber(tier.minQuantity)} →{" "}
                          {formatMoney(tier.unitPrice, currency)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-warning">Chưa có giá — Sales cần nhập bậc giá</span>
                  )}
                  {line.moq != null && (
                    <div className="text-ink-tertiary mt-1">
                      MOQ {formatNumber(line.moq)} (tính theo tổng phôi)
                    </div>
                  )}
                </td>
                <td className={`px-3 py-2 text-right ${MONO}`}>
                  {unit != null ? formatMoney(unit, currency) : "—"}
                </td>
                <td className={`px-3 py-2 text-right ${MONO}`}>
                  {total != null ? formatMoney(total, currency) : "—"}
                </td>
                <td className="px-3 py-2">
                  <SampleState line={line} />
                  {line.sample.approvedSampleId && (
                    <div className={`text-ink-tertiary ${MONO}`}>
                      Mẫu {line.sample.approvedSampleId.slice(0, 8)}
                    </div>
                  )}
                  {sampleAction?.(line)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SampleRequestLink({ href }: { href: string }) {
  return (
    <Link href={href} className="text-accent mt-1 block hover:underline">
      Tạo yêu cầu mẫu
    </Link>
  );
}

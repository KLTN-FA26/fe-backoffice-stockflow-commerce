"use client";

import Link from "next/link";

import { formatMoney } from "@/lib/format/money";
import { formatNumber } from "@/lib/format/number";
import { StatusDot } from "@/components/shared/StatusDot";

import { MONO } from "../copy";

import type { ReactNode } from "react";
import type { QuoteLine } from "@/features/quote/types";

/** Trạng thái mẫu của dòng — qua StatusDot / status-map, không tự tô màu. */
export function SampleState({ line }: { line: QuoteLine }) {
  const status = line.sample.reorder
    ? "Repeat Design"
    : line.sample.satisfied
      ? "Sample Approved"
      : "Sample Required";
  return <StatusDot domain="design" status={status} />;
}

/** Đơn giá / thành tiền hiển thị: đã chấp nhận → số chốt; còn lại → số đề xuất (BE tính). */
export function linePrice(line: QuoteLine) {
  const accepted = line.acceptedUnitPrice != null;
  return {
    unit: accepted ? line.acceptedUnitPrice : line.proposedUnitPrice,
    total: accepted ? line.acceptedLineTotal : line.proposedLineTotal,
    quantity: line.acceptedQuantity ?? line.quantity,
  };
}

const TH = "px-3 py-2 font-medium";

/**
 * Bảng dòng báo giá (back-office) — số liệu đọc nguyên từ BE, FE không tự tính giá.
 * `sampleAction` gắn nút "Tạo yêu cầu mẫu" theo dòng. Vùng cuộn ngang focus được bằng bàn phím.
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
    <div
      role="region"
      aria-label="Các dòng của báo giá"
      tabIndex={0}
      className="border-border-default focus-visible:ring-brand overflow-x-auto rounded-[var(--r-sm)] border focus-visible:ring-2 focus-visible:outline-none"
    >
      <table className="w-full min-w-[860px] text-[0.8125rem]">
        <caption className="sr-only">Các dòng của báo giá</caption>
        <thead className="bg-bg-subtle text-ink-secondary text-left">
          <tr>
            <th scope="col" className={TH}>
              #
            </th>
            <th scope="col" className={TH}>
              Phôi / thiết kế
            </th>
            <th scope="col" className={`${TH} text-right`}>
              SL (cái)
            </th>
            <th scope="col" className={TH}>
              Bậc giá (từ SL → đơn giá)
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Đơn giá
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Thành tiền
            </th>
            <th scope="col" className={TH}>
              Mẫu
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const { unit, total, quantity } = linePrice(line);
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
                  {formatNumber(quantity)}
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
                    <span className="text-ink-secondary">Chưa có giá — Sales cần nhập bậc giá</span>
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

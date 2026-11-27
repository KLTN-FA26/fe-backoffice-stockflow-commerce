"use client";

import Link from "next/link";
import { FileClock } from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";
import { useState } from "react";

import { ADMIN_ROUTES, CUSTOMER_FALLBACK_LABEL, PAGE_SIZE } from "@/constants";
import { formatMoney } from "@/lib/format/money";
import { formatDateTime } from "@/lib/format/date";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { RefetchBar } from "@/components/shared/RefetchBar";

import { useContractCreditReviews } from "../../queries";
import { creditReviewReasonText } from "../../sales-contract-rules";
import { OrderLoadError } from "../OrderLoadError";
import { OrderTableSkeleton } from "../OrderSkeletons";

import { ContractCreditDecision } from "./ContractCreditDecision";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { ContractCreditReview } from "../../contract-credit-review-schemas";

const MONO = "font-[family-name:var(--font-mono)]";
const money = (amount: number) => formatMoney(amount);

function columns(canOpenOrders: boolean, canDecide: boolean): ColumnDef<ContractCreditReview>[] {
  return [
    {
      key: "contract",
      header: "Hợp đồng",
      cell: (row) => (
        <div className="flex flex-col items-start">
          <span className={`${MONO} text-ink-primary text-[0.8125rem]`}>{row.contractNumber}</span>
          {/* Kế toán không có sales-orders:VIEW_PAGE → không dẫn tới trang đơn bị chặn */}
          {canOpenOrders ? (
            <Link
              href={ADMIN_ROUTES.orders.contract(row.orderId)}
              className={`${MONO} text-accent-text text-xs hover:underline`}
            >
              {row.orderNumber}
            </Link>
          ) : (
            <span className={`${MONO} text-ink-tertiary text-xs`}>{row.orderNumber}</span>
          )}
        </div>
      ),
    },
    {
      key: "customer",
      header: "Khách hàng",
      cell: (row) => (
        <div className="flex flex-col items-start">
          <span className="text-ink-primary text-[0.8125rem]">
            {row.customer?.name ?? CUSTOMER_FALLBACK_LABEL}
          </span>
          {row.customer?.code && (
            <span className={`${MONO} text-ink-tertiary text-xs`}>{row.customer.code}</span>
          )}
        </div>
      ),
    },
    {
      key: "reason",
      header: "Vì sao phải duyệt",
      className: "min-w-72",
      cell: (row) => (
        <span className="text-ink-primary text-[0.8125rem] whitespace-normal">
          {creditReviewReasonText(row, money)}
        </span>
      ),
    },
    {
      key: "afterDelivery",
      header: "Phần trả sau giao",
      align: "right",
      cell: (row) => (
        <span className={`${MONO} text-ink-primary tabular-nums`}>
          {row.afterDelivery == null ? "—" : money(row.afterDelivery)}
        </span>
      ),
    },
    {
      key: "submittedAt",
      header: "Gửi duyệt lúc",
      cell: (row) => <span className="tabular-nums">{formatDateTime(row.submittedAt)}</span>,
    },
    {
      key: "actions",
      header: "Thao tác",
      cell: (row) => <ContractCreditDecision row={row} canDecide={canDecide} />,
    },
  ];
}

/**
 * Hợp đồng chờ Kế toán duyệt tín dụng TRƯỚC khi gửi (15 BR-11, BE PR #486, `GET /orders/contract-credit-reviews`, cũ
 * nhất trước) — bảng thứ hai của trang đơn treo tín dụng. Trang riêng trên URL (`reviewPage`) để không đụng phân trang
 * của bảng đơn treo.
 */
export function ContractCreditReviewQueue({
  canOpenOrders,
  canDecide,
  bare = false,
}: {
  canOpenOrders: boolean;
  canDecide: boolean;
  /** Nằm trong tab có tên + số đếm (trang đơn treo tín dụng, bo-21): bỏ tiêu đề riêng của khối. */
  bare?: boolean;
}) {
  const [page, setPage] = useQueryState("reviewPage", parseAsInteger.withDefault(1));
  // Số dòng / trang: sở thích tạm của bảng phụ này (không lên URL, state-persistence)
  const [size, setSize] = useState<number>(PAGE_SIZE.md);
  const query = useContractCreditReviews({ page: Math.max(0, page - 1), size });

  return (
    <section
      aria-labelledby={bare ? undefined : "contract-credit-reviews-title"}
      className={bare ? "space-y-2" : "mt-6 space-y-2"}
    >
      {!bare && (
        <h2
          id="contract-credit-reviews-title"
          className="text-ink-primary flex items-center gap-2 text-sm font-semibold"
        >
          <FileClock className="size-3.5" /> Hợp đồng chờ duyệt trước khi gửi
          {query.data && (
            <span className="text-ink-tertiary font-normal tabular-nums">
              ({query.data.totalElements})
            </span>
          )}
        </h2>
      )}
      {query.isError ? (
        <OrderLoadError inline error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <OrderTableSkeleton />
      ) : (
        <>
          <RefetchBar active={query.isFetching} label="Đang tải lại hợp đồng chờ duyệt" />
          <DataTable
            columns={columns(canOpenOrders, canDecide)}
            data={query.data.items}
            rowKey={(row) => row.reviewId}
            pageSize={size}
            caption={`Hiển thị ${query.data.items.length} / ${query.data.totalElements} hợp đồng`}
            emptyState={
              <EmptyState
                className="rounded-none border-0 bg-transparent whitespace-normal"
                icon={<FileClock className="size-8" />}
                title="Không có hợp đồng chờ duyệt"
                description="Hợp đồng Sale gửi mà vượt hạn mức hoặc khách đang quá hạn sẽ hiện ở đây."
              />
            }
            serverPagination={{
              page: query.data.page,
              size: query.data.size,
              totalElements: query.data.totalElements,
              totalPages: query.data.totalPages,
              hasNext: query.data.hasNext,
              hasPrevious: query.data.hasPrevious,
              onPageChange: (p) => void setPage(p + 1),
              onPageSizeChange: (next) => {
                setSize(next);
                void setPage(1);
              },
            }}
          />
        </>
      )}
    </section>
  );
}

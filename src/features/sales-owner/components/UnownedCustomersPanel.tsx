"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, UserRoundPlus } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { SALES_OWNER_STATE_LABELS } from "@/constants/labels-sales-owner";

import { formatDate } from "@/lib/format/date";

import { ChangeSalesOwnerDialog } from "@/components/backoffice/ChangeSalesOwnerDialog";
import { DataTable } from "@/components/shared/DataTable";
import { DetailPanel } from "@/components/shared/DetailPanel";
import { ToolbarSwitch } from "@/components/shared/ListToolbar";
import { rowActionsColumn } from "@/components/shared/RowActionsMenu";
import { Skeleton } from "@/components/shared/Skeleton";

import { useUnownedCustomers } from "../queries";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { OwnedCustomer } from "../api";

const PAGE_SIZES = [10, 20, 50];

const COLUMNS: ColumnDef<OwnedCustomer>[] = [
  {
    key: "fullName",
    header: "Khách hàng",
    className: "min-w-48",
    cell: (row) => (
      <Link
        href={ADMIN_ROUTES.customers.detail(row.customerId)}
        className="text-ink-primary font-medium hover:underline"
      >
        {row.fullName}
      </Link>
    ),
  },
  { key: "former", header: "Người cũ", cell: (row) => row.salesOwnerName ?? "—" },
  {
    key: "since",
    header: "Từ ngày",
    cell: (row) => (row.salesOwnerSince ? formatDate(row.salesOwnerSince) : "—"),
  },
];

/**
 * "Cần giao người phụ trách" (BR-S08, ca #7, #8): khách của Sale đã nghỉ / bị khoá chờ Manager giao; công tắc xem khách
 * chưa từng có người phụ trách (ca #2). Giao nhanh từng khách (gợi ý Sale còn trống nhất), hoặc chuyển mọi khách của
 * người cũ trong một lô.
 */
export function UnownedCustomersPanel({
  canUpdate,
  onTransferAllOf,
}: {
  canUpdate: boolean;
  onTransferAllOf: (owner: { userId: string; name: string }) => void;
}) {
  const [neverOwned, setNeverOwned] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(PAGE_SIZES[0] ?? 10);
  const [assigning, setAssigning] = useState<OwnedCustomer | null>(null);
  const state = neverOwned ? "UNASSIGNED" : "NEEDS_ASSIGNMENT";
  const query = useUnownedCustomers({ state, page, size });
  const data = query.data;

  return (
    <DetailPanel
      title={SALES_OWNER_STATE_LABELS[state]}
      count={data?.totalElements}
      actions={
        <ToolbarSwitch
          label="Khách chưa từng có người phụ trách"
          checked={neverOwned}
          onCheckedChange={(on) => {
            setNeverOwned(on);
            setPage(0);
          }}
        />
      }
      flush
    >
      {query.isPending && <Skeleton className="m-4 h-16" />}
      {query.isError && (
        <p role="alert" className="text-danger p-4 text-[0.8125rem]">
          Không tải được danh sách khách.{" "}
          <button type="button" className="underline" onClick={() => void query.refetch()}>
            Thử lại
          </button>
        </p>
      )}
      {data && (
        <DataTable
          data={data.items}
          columns={[
            ...COLUMNS,
            rowActionsColumn<OwnedCustomer>((row) => ({
              label: `Thao tác — ${row.fullName}`,
              actions: [
                {
                  label: "Giao người phụ trách…",
                  icon: UserRoundPlus,
                  onSelect: () => setAssigning(row),
                  disabled: !canUpdate,
                },
                ...(row.salesOwnerId && row.salesOwnerName
                  ? [
                      {
                        label: `Chuyển mọi khách của ${row.salesOwnerName}…`,
                        icon: ArrowRightLeft,
                        onSelect: () =>
                          onTransferAllOf({
                            userId: row.salesOwnerId ?? "",
                            name: row.salesOwnerName ?? "",
                          }),
                        disabled: !canUpdate,
                      },
                    ]
                  : []),
              ],
            })),
          ]}
          rowKey={(row) => row.customerId}
          pageSizeOptions={PAGE_SIZES}
          serverPagination={{
            ...data,
            onPageChange: setPage,
            onPageSizeChange: (next) => {
              setSize(next);
              setPage(0);
            },
          }}
          emptyState="Không có khách nào chờ giao."
        />
      )}
      {assigning && (
        <ChangeSalesOwnerDialog
          customerId={assigning.customerId}
          customerName={assigning.fullName}
          assign
          defaultReason={state === "NEEDS_ASSIGNMENT" ? "STAFF_LEFT" : ""}
          onClose={() => setAssigning(null)}
        />
      )}
    </DetailPanel>
  );
}

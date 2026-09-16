"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "cn";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  PackageCheck,
  ShoppingCart,
  Truck,
  Warehouse,
  ClipboardList,
  Receipt,
  ArrowRightLeft,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatTile } from "@/components/shared/StatTile";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  codeCell,
  textCell,
  subCodeCell,
  dateCell,
  numberCell,
  statusCell,
} from "@/components/shared/column-helpers";
import {
  orders,
  purchaseOrders,
  receipts,
  invoices,
  pickTasks,
  packingTasks,
  shipments,
  putawayTasks,
  transferOrders,
  moveTasks,
  replenishmentProposals,
  warehouseKpis,
  type StatusDomain,
  type PurchaseOrder,
  type Invoice,
  type PickTask,
  type PackingTask,
  type Shipment,
  type PutawayTask,
  type TransferOrder,
  type MoveTask,
} from "@/lib/mock-data";

/* -------------------------------------------------------------------------- */
/*  Types                                                                    */
/* -------------------------------------------------------------------------- */

interface WarningItem {
  id: string;
  document: string;
  module: string;
  status: string;
  domain: StatusDomain;
  description: string;
  date: string;
  href: string;
}

interface ActivityItem {
  id: string;
  description: string;
  timestamp: string;
  type: "info" | "warning" | "success";
}

/* -------------------------------------------------------------------------- */
/*  KPI Stats — computed from mock data                                      */
/* -------------------------------------------------------------------------- */

function computeKpis() {
  const ordersPending = orders.filter((o) =>
    ["Pending Payment", "Confirmed", "In Production", "Ready to Fulfill"].includes(o.status),
  ).length;

  const poPendingApproval = purchaseOrders.filter((po) => po.status === "Pending Approval").length;

  const receiptsProcessing = receipts.filter((r) =>
    ["Draft", "Confirmed", "In Putaway"].includes(r.status),
  ).length;

  const pickAttention = pickTasks.filter((pk) => ["Short", "On Hold"].includes(pk.status)).length;

  const shipmentExceptions = shipments.filter((sh) =>
    ["Exception", "Delivery Failed", "Returning"].includes(sh.status),
  ).length;

  const transfersInTransit = transferOrders.filter(
    (to) => to.status === "In Transit" || to.status === "Partially Received",
  ).length;

  return [
    {
      label: "Đơn chờ xử lý",
      value: ordersPending,
      icon: ClipboardList,
      delta: `${orders.length} tổng đơn`,
      deltaDirection: ordersPending > 3 ? ("down" as const) : ("up" as const),
    },
    {
      label: "PO chờ duyệt",
      value: poPendingApproval,
      icon: ShoppingCart,
      delta: `${purchaseOrders.length} PO tổng`,
      deltaDirection: poPendingApproval > 0 ? ("down" as const) : ("up" as const),
    },
    {
      label: "Phiếu nhận đang xử lý",
      value: receiptsProcessing,
      icon: Receipt,
      delta: `${receipts.length} phiếu tổng`,
      deltaDirection: "flat" as const,
    },
    {
      label: "Pick cần chú ý",
      value: pickAttention,
      icon: PackageCheck,
      delta: `${pickTasks.length} pick tổng`,
      deltaDirection: pickAttention > 0 ? ("down" as const) : ("up" as const),
    },
    {
      label: "Vận đơn ngoại lệ",
      value: shipmentExceptions,
      icon: Truck,
      delta: `${shipments.length} vận đơn tổng`,
      deltaDirection: shipmentExceptions > 0 ? ("down" as const) : ("up" as const),
    },
    {
      label: "Chuyển kho đang vận chuyển",
      value: transfersInTransit,
      icon: ArrowRightLeft,
      delta: `${transferOrders.length} lệnh tổng`,
      deltaDirection: "flat" as const,
    },
  ];
}

/* -------------------------------------------------------------------------- */
/*  Warning items — from all documents                                       */
/* -------------------------------------------------------------------------- */

function collectWarningItems(): WarningItem[] {
  const items: WarningItem[] = [];

  // PO: Pending Approval
  purchaseOrders
    .filter((po: PurchaseOrder) => po.status === "Pending Approval")
    .forEach((po: PurchaseOrder) =>
      items.push({
        id: po.poId,
        document: po.poNumber,
        module: "Đơn đặt NCC",
        status: po.status,
        domain: "po",
        description: po.notes || "Chờ duyệt",
        date: po.orderDate,
        href: "/admin/purchase-orders",
      }),
    );

  // Invoice: Exception, Disputed
  invoices
    .filter((inv: Invoice) => ["Exception", "Disputed"].includes(inv.status))
    .forEach((inv: Invoice) =>
      items.push({
        id: inv.invoiceId,
        document: inv.invoiceNumber,
        module: "Hoá đơn NCC",
        status: inv.status,
        domain: "invoice",
        description: inv.disputeNote || "Lỗi đối chiếu",
        date: inv.invoiceDate,
        href: "/admin/invoices",
      }),
    );

  // Pick: Short, On Hold
  pickTasks
    .filter((pk: PickTask) => ["Short", "On Hold"].includes(pk.status))
    .forEach((pk: PickTask) =>
      items.push({
        id: pk.pickId,
        document: pk.pickNumber,
        module: "Lấy hàng",
        status: pk.status,
        domain: "pick",
        description: pk.lines[0]?.shortReason || "Cần xử lý",
        date: pk.createdAt.split("T")[0]!,
        href: "/admin/picking",
      }),
    );

  // Packing: Verification Failed, On Hold
  packingTasks
    .filter((pa: PackingTask) => ["Verification Failed", "On Hold"].includes(pa.status))
    .forEach((pa: PackingTask) =>
      items.push({
        id: pa.taskId,
        document: pa.taskNo,
        module: "Đóng gói",
        status: pa.status,
        domain: "pack",
        description: pa.verificationNote || "Cần xử lý",
        date: pa.createdAt.split("T")[0]!,
        href: "/admin/packing",
      }),
    );

  // Shipment: Exception, Delivery Failed
  shipments
    .filter((sh: Shipment) => ["Exception", "Delivery Failed"].includes(sh.status))
    .forEach((sh: Shipment) =>
      items.push({
        id: sh.shipmentId,
        document: sh.shipmentNumber,
        module: "Vận đơn",
        status: sh.status,
        domain: "shipment",
        description: sh.trackingEvents[sh.trackingEvents.length - 1]?.note || "Ngoại lệ vận chuyển",
        date: sh.createdAt.split("T")[0]!,
        href: "/admin/shipments",
      }),
    );

  // Transfer: Partially Received
  transferOrders
    .filter((to: TransferOrder) => to.status === "Partially Received")
    .forEach((to: TransferOrder) =>
      items.push({
        id: to.transferOrderId,
        document: to.toNumber,
        module: "Chuyển kho",
        status: to.status,
        domain: "to",
        description: to.reason,
        date: to.createdAt.split("T")[0]!,
        href: "/admin/transfers",
      }),
    );

  // Putaway: On Hold
  putawayTasks
    .filter((pt: PutawayTask) => pt.status === "On Hold")
    .forEach((pt: PutawayTask) =>
      items.push({
        id: pt.taskId,
        document: pt.taskNo,
        module: "Cất hàng",
        status: pt.status,
        domain: "putaway",
        description: pt.holdReason || "Tạm dừng",
        date: pt.createdAt.split("T")[0]!,
        href: "/admin/putaway",
      }),
    );

  // Move: On Hold, Discrepancy
  moveTasks
    .filter((mv: MoveTask) => ["On Hold", "Discrepancy"].includes(mv.status))
    .forEach((mv: MoveTask) =>
      items.push({
        id: mv.moveTaskId,
        document: mv.moveNumber,
        module: "Di chuyển",
        status: mv.status,
        domain: "move",
        description: mv.discrepancyNote || "Cần xử lý",
        date: mv.createdAt.split("T")[0]!,
        href: "/admin/moves",
      }),
    );

  return items.slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/*  Activity timeline — from recent events across modules                    */
/* -------------------------------------------------------------------------- */

function collectActivities(): ActivityItem[] {
  const activities: ActivityItem[] = [];

  // Recent shipment events
  for (const sh of shipments) {
    for (const ev of sh.trackingEvents) {
      let type: ActivityItem["type"] = "info";
      if (["Delivery Failed", "Exception", "Returning"].includes(ev.status)) {
        type = "warning";
      } else if (ev.status === "Delivered") {
        type = "success";
      }
      activities.push({
        id: ev.eventId,
        description: `${sh.shipmentNumber}: ${ev.status}${ev.note ? ` — ${ev.note}` : ""} (${ev.location})`,
        timestamp: ev.timestamp,
        type,
      });
    }
  }

  // Sort by timestamp desc, take 8
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return activities.slice(0, 8);
}

/* -------------------------------------------------------------------------- */
/*  Warehouse KPI helpers                                                    */
/* -------------------------------------------------------------------------- */

function computeWarehouseStats() {
  return warehouseKpis.map((kpi) => ({
    warehouseId: kpi.warehouseId,
    utilization: Math.round(kpi.utilizationPct * 100),
    honeycombing: Math.round(kpi.honeycombingPct * 100),
    overloaded: kpi.overloadedLocations,
    empty: kpi.emptyLocations,
    blocked: kpi.blockedLocations,
    pendingPutaway: kpi.pendingPutaway,
    openPicks: kpi.openPickTasks,
  }));
}

/* -------------------------------------------------------------------------- */
/*  Warning table columns                                                    */
/* -------------------------------------------------------------------------- */

const warningColumns = [
  codeCell<WarningItem>("document", "Mã chứng từ", (row) => row.document),
  textCell<WarningItem>("module", "Module", (row) => row.module),
  statusCell<WarningItem>(
    "status",
    "Trạng thái",
    (row) => row.status,
    (row) => row.domain,
    { withIcon: true },
  ),
  textCell<WarningItem>("description", "Mô tả", (row) => row.description, { lineClamp: true }),
  dateCell<WarningItem>("date", "Ngày", (row) => row.date),
];

/* -------------------------------------------------------------------------- */
/*  Replenishment preview columns                                            */
/* -------------------------------------------------------------------------- */

const replenishmentColumns = [
  codeCell<(typeof replenishmentProposals)[number]>("proposalId", "Mã", (row) => row.proposalId),
  subCodeCell<(typeof replenishmentProposals)[number]>("skuId", "SKU", (row) => row.skuId),
  numberCell<(typeof replenishmentProposals)[number]>(
    "suggestedQty",
    "SL đề xuất",
    (row) => row.suggestedQty,
  ),
  statusCell<(typeof replenishmentProposals)[number]>(
    "status",
    "Trạng thái",
    (row) => row.status,
    "proposal",
  ),
  textCell<(typeof replenishmentProposals)[number]>("reason", "Lý do", (row) => row.reason, {
    color: "secondary",
    lineClamp: true,
  }),
];

/* -------------------------------------------------------------------------- */
/*  Page                                                                     */
/* -------------------------------------------------------------------------- */

export default function AdminDashboardPage() {
  const kpis = useMemo(() => computeKpis(), []);
  const warningItems = useMemo(() => collectWarningItems(), []);
  const activities = useMemo(() => collectActivities(), []);
  const whStats = useMemo(() => computeWarehouseStats(), []);

  return (
    <>
      <PageHeader title="Tổng quan" subtitle="Theo dõi vận hành kho, đơn hàng và tồn kho." />

      {/* ================================================================ */}
      {/* Row 1: KPI StatTiles                                             */}
      {/* ================================================================ */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <StatTile
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            delta={kpi.delta}
            deltaDirection={kpi.deltaDirection}
          />
        ))}
      </div>

      {/* ================================================================ */}
      {/* Row 2: Warning table + Activity timeline                         */}
      {/* ================================================================ */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        {/* Warning table */}
        <div className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-[var(--card-shadow)]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-warning size-4" />
              <h2 className="text-ink-primary text-[0.875rem] font-semibold">Cần xử lý ngay</h2>
              <span className="bg-warning/12 text-warning rounded-full px-2 py-0.5 text-[0.625rem] font-bold tabular-nums">
                {warningItems.length}
              </span>
            </div>
          </div>
          {warningItems.length > 0 ? (
            <DataTable
              data={warningItems}
              columns={warningColumns}
              rowKey={(row) => row.id}
              caption={`${warningItems.length} mục cần xử lý`}
              flagRow={(row) =>
                [
                  "Exception",
                  "Delivery Failed",
                  "Short",
                  "Verification Failed",
                  "Discrepancy",
                ].includes(row.status)
              }
              pageSize={10}
            />
          ) : (
            <EmptyState
              title="Không có mục nào cần xử lý"
              description="Tất cả chứng từ đang hoạt động bình thường."
            />
          )}
        </div>

        {/* Activity timeline */}
        <div className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-[var(--card-shadow)]">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="text-info size-4" />
            <h2 className="text-ink-primary text-[0.875rem] font-semibold">Hoạt động gần đây</h2>
          </div>
          {activities.length > 0 ? (
            <div className="relative pl-6">
              {/* Vertical line: left 6px, w 2px → center 7px */}
              <div className="bg-border-default absolute top-1 bottom-1 left-[6px] w-0.5" />
              {activities.map((act) => (
                <div key={act.id} className="relative pb-4 last:pb-0">
                  {/* Dot: 11px, center must be 7px from container → left from child = -(24-1.5) = -22.5px */}
                  <div
                    className={cn(
                      "border-bg-surface absolute top-[4px] -left-[22.5px] size-[11px] rounded-full border-2",
                      act.type === "warning" && "bg-warning",
                      act.type === "success" && "bg-positive",
                      act.type === "info" && "bg-info",
                    )}
                  />
                  <div className="text-ink-primary text-[0.8125rem] leading-snug">
                    {act.description}
                  </div>
                  <div className="text-ink-tertiary mt-0.5 text-xs tabular-nums">
                    {new Date(act.timestamp).toLocaleString("vi-VN")}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Chưa có hoạt động"
              description="Các sự kiện vận đơn sẽ hiển thị ở đây."
            />
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* Row 3: Warehouse KPIs + Replenishment preview                    */}
      {/* ================================================================ */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* Warehouse performance */}
        <div className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-[var(--card-shadow)]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Warehouse className="text-accent size-4" />
              <h2 className="text-ink-primary text-[0.875rem] font-semibold">
                Hiệu suất kho hôm nay
              </h2>
            </div>
            <Link
              href="/admin/warehouse-map"
              className="text-accent flex items-center gap-1 text-xs font-medium hover:underline"
            >
              Xem chi tiết <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {whStats.map((wh) => {
              const whName =
                wh.warehouseId === "WH-HN-01"
                  ? "HN01"
                  : wh.warehouseId === "WH-HCM-01"
                    ? "HCM01"
                    : "DN01";
              return (
                <div
                  key={wh.warehouseId}
                  className="border-border-default rounded-[var(--r-sm)] border p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-semibold">
                      {whName}
                    </span>
                    <span className="text-ink-tertiary text-xs">
                      Sử dụng{" "}
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          wh.utilization > 80
                            ? "text-danger"
                            : wh.utilization > 60
                              ? "text-warning"
                              : "text-positive",
                        )}
                      >
                        {wh.utilization}%
                      </span>
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="bg-bg-subtle mb-2 h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        wh.utilization > 80
                          ? "bg-danger"
                          : wh.utilization > 60
                            ? "bg-warning"
                            : "bg-positive",
                      )}
                      style={{ width: `${wh.utilization}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-ink-tertiary">Trống</span>
                      <span className="text-ink-primary ml-1 font-semibold tabular-nums">
                        {wh.empty}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-tertiary">Quá tải</span>
                      <span
                        className={cn(
                          "ml-1 font-semibold tabular-nums",
                          wh.overloaded > 0 ? "text-danger" : "text-ink-primary",
                        )}
                      >
                        {wh.overloaded}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-tertiary">Chặn</span>
                      <span
                        className={cn(
                          "ml-1 font-semibold tabular-nums",
                          wh.blocked > 0 ? "text-warning" : "text-ink-primary",
                        )}
                      >
                        {wh.blocked}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-ink-tertiary">Chờ cất</span>
                      <span className="text-ink-primary ml-1 font-semibold tabular-nums">
                        {wh.pendingPutaway}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-tertiary">Pick mở</span>
                      <span className="text-ink-primary ml-1 font-semibold tabular-nums">
                        {wh.openPicks}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-tertiary">Honeycombing</span>
                      <span className="text-ink-primary ml-1 font-semibold tabular-nums">
                        {wh.honeycombing}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Replenishment preview */}
        <div className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-[var(--card-shadow)]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-accent size-4" />
              <h2 className="text-ink-primary text-[0.875rem] font-semibold">Đề xuất nhập hàng</h2>
              <span className="bg-accent/12 text-accent rounded-full px-2 py-0.5 text-[0.625rem] font-bold tabular-nums">
                {replenishmentProposals.length}
              </span>
            </div>
            <Link
              href="/admin/replenishment"
              className="text-accent flex items-center gap-1 text-xs font-medium hover:underline"
            >
              Xem tất cả <ArrowRight className="size-3" />
            </Link>
          </div>
          {replenishmentProposals.length > 0 ? (
            <DataTable
              data={replenishmentProposals.slice(0, 5)}
              columns={replenishmentColumns}
              rowKey={(row) => row.proposalId}
              caption={`${replenishmentProposals.length} đề xuất`}
              pageSize={5}
            />
          ) : (
            <EmptyState
              title="Không có đề xuất"
              description="Hệ thống chưa phát hiện SKU cần nhập thêm."
            />
          )}
        </div>
      </div>
    </>
  );
}

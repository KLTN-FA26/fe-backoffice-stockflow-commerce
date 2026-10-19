/**
 * MOCK ONLY — rendered solely when `useIsMock()` is true.
 *
 * These widgets have no backend endpoint (cross-module "needs attention" list, shipment tracking
 * feed, warehouse utilisation KPIs, replenishment proposals), so their data exists only in the
 * demo dataset. In real mode they are not rendered: nothing here may reach a production screen.
 * `mock-data` is imported directly here, as the dashboard page did before; moving these widgets
 * behind mock routes would only invent endpoints the backend does not have.
 */

import {
  invoices,
  packingTasks,
  pickTasks,
  purchaseOrders,
  putawayTasks,
  shipments,
  transferOrders,
  moveTasks,
  type Invoice,
  type MoveTask,
  type PackingTask,
  type PickTask,
  type PurchaseOrder,
  type PutawayTask,
  type Shipment,
  type StatusDomain,
  type TransferOrder,
} from "@/lib/mock-data";

export interface WarningItem {
  id: string;
  document: string;
  module: string;
  status: string;
  domain: StatusDomain;
  description: string;
  date: string;
  href: string;
}

export function collectWarningItems(): WarningItem[] {
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

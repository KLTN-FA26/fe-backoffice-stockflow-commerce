export type WorkshopRole =
  "PRODUCTION_STAFF" | "QC_STAFF" | "WAREHOUSE_STAFF" | "WAREHOUSE_MANAGER";

export type WorkshopLsxStatus =
  "Ready" | "Material Issued" | "Printing" | "QC" | "Completed" | "On Hold";

export interface WorkshopLSX {
  id: string;
  code: string;
  type: "SAMPLE" | "ORDER";
  orderCode?: string;
  customerName: string;
  blankSku: string;
  blankName: string;
  plannedQuantity: number;
  scannedBlanksQuantity: number;
  isBlanksCompleted: boolean;

  // Printing metrics
  printedGoodQuantity: number;
  printedScrapQuantity: number;
  scrapReasons: {
    reason: string;
    quantity: number;
    timestamp: string;
    recordedBy: string;
  }[];

  // QC metrics
  qcPassedQuantity: number;
  qcFailedQuantity: number;
  qcScrapReasons: {
    reason: string;
    quantity: number;
    timestamp: string;
    notes?: string;
  }[];
  qcReferenceSampleUrl: string; // Bản mẫu đã được khách phê duyệt
  qcPrintFileUrl: string;

  // Handoff to packing
  isHandedOffToPacking: boolean;
  handedOffAt?: string;
  handedOffBy?: string;

  status: WorkshopLsxStatus;
  machineId?: string;
  dueDate: string;
  isOverdue: boolean;
  priority: "HIGH" | "NORMAL";
  reprintRound: number;
}

export interface WorkshopMetrics {
  totalActiveOrders: number;
  readyOrdersCount: number;
  materialIssuedCount: number;
  printingCount: number;
  qcPendingCount: number;
  completedTodayCount: number;
  overdueOrdersCount: number;
  scrapRatePercent: number;
  pendingSampleApprovalCount: number;
}

export interface RegisteredBarcode {
  barcode: string;
  blankSku: string;
  blankName: string;
  lotNumber: string;
  warehouseLocation: string;
  availableQty: number;
  status: "AVAILABLE" | "DEPLETED" | "QUARANTINED";
  expiryDate?: string;
}

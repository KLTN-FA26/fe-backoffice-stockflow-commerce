export type SampleStatus = 
  | "Draft"
  | "Submitted"
  | "In Production"
  | "Ready"
  | "Sent to Customer"
  | "Approved"
  | "Changes Requested"
  | "Cancelled";

export interface SampleRequest {
  id: string;
  code: string;
  customerName: string;
  customerCode: string;
  customerEmail: string;
  blankSku: string;
  blankName: string;
  designName: string;
  designSnapshotUrl: string;
  printSpec: {
    technology: string;
    colors: string[];
    dimensions: string;
    checksum: string;
  };
  sampleQuantity: number;
  dueDate: string;
  linkedQuoteCode?: string;
  roundNumber: number;
  status: SampleStatus;
  history: {
    round: number;
    status: SampleStatus;
    timestamp: string;
    actor: string;
    comment?: string;
  }[];
  trackingCode?: string;
  carrier?: string;
  customerFeedback?: string;
  approvedAt?: string;
}

export type ProductionOrderType = "SAMPLE" | "ORDER";

export type ProductionOrderStatus = 
  | "Pending Prepress"
  | "Ready"
  | "Material Issued"
  | "Printing"
  | "QC"
  | "Completed"
  | "On Hold"
  | "Cancelled";

export interface PrepressArtifact {
  fileName: string;
  fileSize: string;
  checksum: string;
  downloadUrl: string;
  previewUrl: string;
  colorSeparation: string[];
  dimensions: string;
  resolutionDpi: number;
}

export interface ProductionOrder {
  id: string;
  code: string;
  type: ProductionOrderType;
  status: ProductionOrderStatus;
  previousStatus?: ProductionOrderStatus; // Dùng khi resume từ On Hold
  sourceId: string; // Sample Request ID hoặc Order Line ID
  orderCode?: string;
  customerName: string;
  blankSku: string;
  blankName: string;
  plannedQuantity: number;
  issuedQuantity: number;
  goodQuantity: number;
  scrapQuantity: number;
  dueDate: string;
  createdAt: string;
  prepressCheckedAt?: string;
  prepressCheckResult?: "PASS" | "FAIL";
  prepressNotes?: string;
  prepressArtifact: PrepressArtifact;
  holdReason?: string;
  holdHistory: {
    timestamp: string;
    actor: string;
    reason: string;
    type: "HOLD" | "RESUME";
  }[];
  cancellationReason?: string;
  cancellationPolicyOutcome?: string;
}

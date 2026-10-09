export type SubcontractMode = "FULL_SERVICE" | "PRINT_PROCESSING_ONLY";

export type SubcontractStatus = 
  | "DRAFT"
  | "DISPATCHED" // Đã xuất phôi & gửi xưởng ngoài
  | "IN_PRODUCTION"
  | "RECEIVED_PARTIAL"
  | "RECEIVED_COMPLETED"
  | "CANCELLED";

export interface SubcontractPartner {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  address: string;
  taxCode: string;
  rating: number;
}

export interface SubcontractOrder {
  id: string;
  code: string; // SCO-2026-xxxx
  parentLsxId: string;
  parentLsxCode: string;
  partnerId: string;
  partnerName: string;
  mode: SubcontractMode;
  blankSku: string;
  blankName: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  dueDate: string;
  status: SubcontractStatus;
  
  // Send-out details
  dispatchedAt?: string;
  dispatchedBy?: string;
  dispatchNoteCode?: string;
  driverName?: string;
  vehicleNumber?: string;
  
  // Return tracking
  receivedGoodQuantity: number;
  receivedScrapQuantity: number;
  returnHistory: {
    timestamp: string;
    receivedQty: number;
    scrapQty: number;
    receiver: string;
    notes?: string;
  }[];
}

export interface ParentProductionOrder {
  id: string;
  code: string;
  customerName: string;
  blankSku: string;
  blankName: string;
  totalQuantity: number;
  inHouseQuantity: number;
  subcontractedQuantity: number;
  dueDate: string;
  status: string;
  children: SubcontractOrder[];
}

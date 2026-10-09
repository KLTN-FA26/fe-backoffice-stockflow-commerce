import { 
  SubcontractOrder, 
  ParentProductionOrder, 
  SubcontractPartner, 
  SubcontractMode 
} from "./types";

const INITIAL_PARTNERS: SubcontractPartner[] = [
  {
    id: "part-01",
    code: "NCC-GC-TANBINH",
    name: "Công ty TNHH In Bao Bì Tân Bình Phát",
    contactPerson: "Anh Tuấn (Giám đốc xưởng)",
    phone: "0908 123 456",
    address: "KCN Tân Bình, P. Tây Thạnh, Q. Tân Phú, TP. HCM",
    taxCode: "0314889921",
    rating: 4.8,
  },
  {
    id: "part-02",
    code: "NCC-GC-DONGA",
    name: "Xưởng In Offset & Flexo Đông Á",
    contactPerson: "Chị Thảo (Phòng Kế hoạch)",
    phone: "0912 345 678",
    address: "Đường số 3, KCN Sóng Thần 1, Dĩ An, Bình Dương",
    taxCode: "3702114455",
    rating: 4.6,
  },
  {
    id: "part-03",
    code: "NCC-GC-VIETBAO",
    name: "Công ty Cổ phần Bao Bì Việt Bảo Long",
    contactPerson: "Anh Nam (Điều hành)",
    phone: "0988 776 655",
    address: "Cụm Công nghiệp Vĩnh Lộc B, Bình Chánh, TP. HCM",
    taxCode: "0316772211",
    rating: 4.9,
  },
];

const INITIAL_PARENT_ORDERS: ParentProductionOrder[] = [
  {
    id: "lsx-parent-01",
    code: "LSX-2026-1002",
    customerName: "Tập đoàn F&B Golden Spoon",
    blankSku: "TO-GIAY-750-KRAFT",
    blankName: "Tô giấy Kraft 750ml chống thấm",
    totalQuantity: 20000,
    inHouseQuantity: 12000,
    subcontractedQuantity: 8000,
    dueDate: "2026-10-20",
    status: "SUBCONTRACTED",
    children: [
      {
        id: "sco-001",
        code: "SCO-2026-0081",
        parentLsxId: "lsx-parent-01",
        parentLsxCode: "LSX-2026-1002",
        partnerId: "part-01",
        partnerName: "Công ty TNHH In Bao Bì Tân Bình Phát",
        mode: "PRINT_PROCESSING_ONLY",
        blankSku: "TO-GIAY-750-KRAFT",
        blankName: "Tô giấy Kraft 750ml chống thấm",
        quantity: 8000,
        unitPrice: 450,
        totalCost: 3600000,
        dueDate: "2026-10-18",
        status: "DISPATCHED",
        dispatchedAt: "2026-10-09 08:30",
        dispatchedBy: "Hoàng Minh (Thủ kho)",
        dispatchNoteCode: "PXK-GC-2026-0042",
        driverName: "Trần Văn Lợi (Tài xế xe tải Tân Bình Phát)",
        vehicleNumber: "51C-982.14",
        receivedGoodQuantity: 0,
        receivedScrapQuantity: 0,
        returnHistory: [],
      },
    ],
  },
  {
    id: "lsx-parent-02",
    code: "LSX-2026-1003",
    customerName: "Chuỗi Cà phê The Daily Bean",
    blankSku: "LY-GIAY-500-KRAFT",
    blankName: "Ly giấy Kraft 500ml",
    totalQuantity: 50000,
    inHouseQuantity: 50000,
    subcontractedQuantity: 0,
    dueDate: "2026-10-25",
    status: "IN_HOUSE",
    children: [],
  },
  {
    id: "lsx-parent-03",
    code: "LSX-2026-1006",
    customerName: "Hệ thống Trà sữa Toco Cloud",
    blankSku: "LY-NHUA-PP-500",
    blankName: "Ly nhựa PP mờ sần 500ml",
    totalQuantity: 30000,
    inHouseQuantity: 15000,
    subcontractedQuantity: 15000,
    dueDate: "2026-10-22",
    status: "SUBCONTRACTED",
    children: [
      {
        id: "sco-002",
        code: "SCO-2026-0082",
        parentLsxId: "lsx-parent-03",
        parentLsxCode: "LSX-2026-1006",
        partnerId: "part-02",
        partnerName: "Xưởng In Offset & Flexo Đông Á",
        mode: "FULL_SERVICE",
        blankSku: "LY-NHUA-PP-500",
        blankName: "Ly nhựa PP mờ sần 500ml",
        quantity: 15000,
        unitPrice: 850,
        totalCost: 12750000,
        dueDate: "2026-10-20",
        status: "RECEIVED_COMPLETED",
        dispatchedAt: "2026-10-06 09:00",
        dispatchedBy: "Hoàng Minh (Thủ kho)",
        dispatchNoteCode: "PXK-GC-2026-0038",
        driverName: "Nguyễn Thành Đạt",
        vehicleNumber: "60A-112.90",
        receivedGoodQuantity: 15000,
        receivedScrapQuantity: 120,
        returnHistory: [
          {
            timestamp: "2026-10-09 10:15",
            receivedQty: 15000,
            scrapQty: 120,
            receiver: "Trần Anh (QC Nhận hàng)",
            notes: "Kiểm tra đạt chuẩn 100%, mực bám tốt, đóng thùng quy cách 100 ly/cây.",
          },
        ],
      },
    ],
  },
];

class InMemorySubcontractRepo {
  private partners: SubcontractPartner[] = [...INITIAL_PARTNERS];
  private parents: ParentProductionOrder[] = [...INITIAL_PARENT_ORDERS];

  getPartners(): SubcontractPartner[] {
    return this.partners;
  }

  getParentOrders(): ParentProductionOrder[] {
    return this.parents;
  }

  getParentOrderById(id: string): ParentProductionOrder | undefined {
    return this.parents.find((p) => p.id === id || p.code === id);
  }

  getAllSubcontractOrders(): SubcontractOrder[] {
    return this.parents.flatMap((p) => p.children);
  }

  getSubcontractOrderById(id: string): SubcontractOrder | undefined {
    for (const p of this.parents) {
      const found = p.children.find((c) => c.id === id || c.code === id);
      if (found) return found;
    }
    return undefined;
  }

  // SCRUM-442: Split production order for subcontracting
  splitOrder(params: {
    parentLsxId: string;
    quantityToOutsource: number;
    partnerId: string;
    mode: SubcontractMode;
    unitPrice: number;
    dueDate: string;
  }): SubcontractOrder {
    const parent = this.getParentOrderById(params.parentLsxId);
    if (!parent) throw new Error("Parent production order not found");

    if (params.quantityToOutsource <= 0) {
      throw new Error("Số lượng gia công phải lớn hơn 0");
    }

    if (params.quantityToOutsource > parent.inHouseQuantity) {
      throw new Error(
        `Không thể tách vượt quá số lượng sản xuất nội bộ hiện có (${parent.inHouseQuantity.toLocaleString()})`
      );
    }

    const partner = this.partners.find((p) => p.id === params.partnerId);
    if (!partner) throw new Error("Chưa chọn đối tác gia công hợp lệ");

    const allSubs = this.getAllSubcontractOrders();
    const count = allSubs.length + 80;
    const code = `SCO-2026-00${count}`;

    const newSubOrder: SubcontractOrder = {
      id: `sco-${Date.now()}`,
      code,
      parentLsxId: parent.id,
      parentLsxCode: parent.code,
      partnerId: partner.id,
      partnerName: partner.name,
      mode: params.mode,
      blankSku: parent.blankSku,
      blankName: parent.blankName,
      quantity: params.quantityToOutsource,
      unitPrice: params.unitPrice,
      totalCost: params.quantityToOutsource * params.unitPrice,
      dueDate: params.dueDate,
      status: "DRAFT",
      receivedGoodQuantity: 0,
      receivedScrapQuantity: 0,
      returnHistory: [],
    };

    // Điều chỉnh số lượng parent
    parent.inHouseQuantity -= params.quantityToOutsource;
    parent.subcontractedQuantity += params.quantityToOutsource;
    parent.status = "SUBCONTRACTED";
    parent.children.unshift(newSubOrder);

    return newSubOrder;
  }

  // SCRUM-442: Dispatch note & send-out blank scanning
  dispatchSendOut(params: {
    subcontractOrderId: string;
    driverName: string;
    vehicleNumber: string;
    actor: string;
  }): SubcontractOrder {
    const order = this.getSubcontractOrderById(params.subcontractOrderId);
    if (!order) throw new Error("Subcontract order not found");

    const noteCount = Math.floor(100 + Math.random() * 900);
    order.status = "DISPATCHED";
    order.dispatchedAt = new Date().toISOString().replace("T", " ").substring(0, 16);
    order.dispatchedBy = params.actor;
    order.dispatchNoteCode = `PXK-GC-2026-0${noteCount}`;
    order.driverName = params.driverName;
    order.vehicleNumber = params.vehicleNumber;

    return order;
  }

  // SCRUM-442: Receive back & return tracking
  recordReturn(params: {
    subcontractOrderId: string;
    receivedGoodQty: number;
    receivedScrapQty: number;
    receiver: string;
    notes?: string;
  }): SubcontractOrder {
    const order = this.getSubcontractOrderById(params.subcontractOrderId);
    if (!order) throw new Error("Subcontract order not found");

    order.receivedGoodQuantity += params.receivedGoodQty;
    order.receivedScrapQuantity += params.receivedScrapQty;

    order.returnHistory.push({
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
      receivedQty: params.receivedGoodQty,
      scrapQty: params.receivedScrapQty,
      receiver: params.receiver,
      notes: params.notes,
    });

    if (order.receivedGoodQuantity >= order.quantity) {
      order.status = "RECEIVED_COMPLETED";
    } else {
      order.status = "RECEIVED_PARTIAL";
    }

    return order;
  }
}

export const subcontractRepo = new InMemorySubcontractRepo();

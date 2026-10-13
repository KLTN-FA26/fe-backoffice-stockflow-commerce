import { WorkshopLSX, WorkshopMetrics, RegisteredBarcode } from "./types";

const INITIAL_BARCODE_REGISTRY: Record<string, RegisteredBarcode> = {
  "BC-TO-750-LOT2601-LOC-B04": {
    barcode: "BC-TO-750-LOT2601-LOC-B04",
    blankSku: "TO-GIAY-750-KRAFT",
    blankName: "Tô giấy Kraft 750ml chống thấm",
    lotNumber: "LOT-2026-03-A",
    warehouseLocation: "KHO-B04-KAY02",
    availableQty: 15000,
    status: "AVAILABLE",
    expiryDate: "2027-10-01",
  },
  "BC-TO-750-LOT2602-LOC-B05": {
    barcode: "BC-TO-750-LOT2602-LOC-B05",
    blankSku: "TO-GIAY-750-KRAFT",
    blankName: "Tô giấy Kraft 750ml chống thấm",
    lotNumber: "LOT-2026-03-B",
    warehouseLocation: "KHO-B05-KAY01",
    availableQty: 3000,
    status: "AVAILABLE",
    expiryDate: "2027-11-15",
  },
  "BC-TO-750-DEPLETED-LOT99": {
    barcode: "BC-TO-750-DEPLETED-LOT99",
    blankSku: "TO-GIAY-750-KRAFT",
    blankName: "Tô giấy Kraft 750ml chống thấm",
    lotNumber: "LOT-2026-01-EXP",
    warehouseLocation: "KHO-C01-QUARANTINE",
    availableQty: 0,
    status: "DEPLETED",
    expiryDate: "2026-05-01",
  },
  "BC-LY-500-LOT2601-LOC-A01": {
    barcode: "BC-LY-500-LOT2601-LOC-A01",
    blankSku: "LY-GIAY-500-KRAFT",
    blankName: "Ly giấy Kraft 500ml",
    lotNumber: "LOT-2026-02-C",
    warehouseLocation: "KHO-A01-KAY03",
    availableQty: 25000,
    status: "AVAILABLE",
    expiryDate: "2027-08-20",
  },
  "BC-HOP-1000-LOT2601-LOC-C02": {
    barcode: "BC-HOP-1000-LOT2601-LOC-C02",
    blankSku: "HOP-COM-1000-KRAFT",
    blankName: "Hộp cơm Kraft 1000ml",
    lotNumber: "LOT-2026-01-D",
    warehouseLocation: "KHO-C02-KAY01",
    availableQty: 8000,
    status: "AVAILABLE",
    expiryDate: "2027-09-10",
  },
  "BC-LY-350-LOT2601-LOC-A02": {
    barcode: "BC-LY-350-LOT2601-LOC-A02",
    blankSku: "LY-GIAY-350-TRANG",
    blankName: "Ly giấy trắng 350ml",
    lotNumber: "LOT-2026-02-E",
    warehouseLocation: "KHO-A02-KAY04",
    availableQty: 10000,
    status: "AVAILABLE",
    expiryDate: "2027-12-01",
  },
};

const INITIAL_WORKSHOP_ORDERS: WorkshopLSX[] = [
  {
    id: "ws-001",
    code: "LSX-2026-1002",
    type: "ORDER",
    orderCode: "SO-2026-0412",
    customerName: "Tập đoàn F&B Golden Spoon",
    blankSku: "TO-GIAY-750-KRAFT",
    blankName: "Tô giấy Kraft 750ml chống thấm",
    plannedQuantity: 5000,
    scannedBlanksQuantity: 0,
    isBlanksCompleted: false,
    printedGoodQuantity: 0,
    printedScrapQuantity: 0,
    scrapReasons: [],
    qcPassedQuantity: 0,
    qcFailedQuantity: 0,
    qcScrapReasons: [],
    qcReferenceSampleUrl:
      "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&auto=format&fit=crop&q=80",
    qcPrintFileUrl:
      "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&auto=format&fit=crop&q=80",
    isHandedOffToPacking: false,
    status: "Ready",
    dueDate: "2026-10-15",
    isOverdue: false,
    priority: "NORMAL",
    reprintRound: 1,
  },
  {
    id: "ws-002",
    code: "LSX-2026-1003",
    type: "ORDER",
    orderCode: "SO-2026-0419",
    customerName: "Chuỗi Cà phê The Daily Bean",
    blankSku: "LY-GIAY-500-KRAFT",
    blankName: "Ly giấy Kraft 500ml",
    plannedQuantity: 10000,
    scannedBlanksQuantity: 10000,
    isBlanksCompleted: true,
    printedGoodQuantity: 4200,
    printedScrapQuantity: 150,
    scrapReasons: [
      {
        reason: "Lệch bo tràn viền và lem mực Flexo lúc khởi động máy",
        quantity: 150,
        timestamp: "2026-10-08 14:10",
        recordedBy: "Nguyễn Văn Hùng (Thợ in chính)",
      },
    ],
    qcPassedQuantity: 0,
    qcFailedQuantity: 0,
    qcScrapReasons: [],
    qcReferenceSampleUrl:
      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop&q=80",
    qcPrintFileUrl:
      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop&q=80",
    isHandedOffToPacking: false,
    status: "Printing",
    machineId: "FLEXO-02",
    dueDate: "2026-10-14",
    isOverdue: false,
    priority: "HIGH",
    reprintRound: 1,
  },
  {
    id: "ws-003",
    code: "LSX-2026-1005",
    type: "SAMPLE",
    customerName: "Công ty Cổ phần Cà phê Highland Heritage",
    blankSku: "LY-GIAY-350-TRANG",
    blankName: "Ly giấy trơn hai lớp 350ml PE",
    plannedQuantity: 20,
    scannedBlanksQuantity: 20,
    isBlanksCompleted: true,
    printedGoodQuantity: 20,
    printedScrapQuantity: 2,
    scrapReasons: [
      {
        reason: "Kẹt phôi lúc dập nhiệt viền đáy ly",
        quantity: 2,
        timestamp: "2026-10-09 09:30",
        recordedBy: "Vũ Hải (Thợ in)",
      },
    ],
    qcPassedQuantity: 0,
    qcFailedQuantity: 0,
    qcScrapReasons: [],
    qcReferenceSampleUrl:
      "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80",
    qcPrintFileUrl:
      "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80",
    isHandedOffToPacking: false,
    status: "QC",
    machineId: "UV-FLATBED-01",
    dueDate: "2026-10-12",
    isOverdue: false,
    priority: "HIGH",
    reprintRound: 1,
  },
  {
    id: "ws-004",
    code: "LSX-2026-0994",
    type: "ORDER",
    orderCode: "SO-2026-0399",
    customerName: "Bánh mì Má Hải Sài Gòn",
    blankSku: "TO-GIAY-750-KRAFT",
    blankName: "Tô giấy Kraft 750ml chống thấm",
    plannedQuantity: 3000,
    scannedBlanksQuantity: 3000,
    isBlanksCompleted: true,
    printedGoodQuantity: 3000,
    printedScrapQuantity: 40,
    scrapReasons: [
      {
        reason: "Bụi giấy dính lô cao su",
        quantity: 40,
        timestamp: "2026-10-08 10:00",
        recordedBy: "Trần Bảo",
      },
    ],
    qcPassedQuantity: 3000,
    qcFailedQuantity: 0,
    qcScrapReasons: [],
    qcReferenceSampleUrl:
      "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&auto=format&fit=crop&q=80",
    qcPrintFileUrl:
      "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&auto=format&fit=crop&q=80",
    isHandedOffToPacking: false,
    status: "Completed",
    dueDate: "2026-10-08",
    isOverdue: false,
    priority: "NORMAL",
    reprintRound: 1,
  },
  {
    id: "ws-005",
    code: "LSX-2026-0988",
    type: "ORDER",
    orderCode: "SO-2026-0380",
    customerName: "Trà sữa Đô Đô Hà Nội",
    blankSku: "LY-NHUA-PP-500",
    blankName: "Ly nhựa PP mờ sần 500ml",
    plannedQuantity: 4000,
    scannedBlanksQuantity: 4000,
    isBlanksCompleted: true,
    printedGoodQuantity: 4000,
    printedScrapQuantity: 35,
    scrapReasons: [],
    qcPassedQuantity: 4000,
    qcFailedQuantity: 0,
    qcScrapReasons: [],
    qcReferenceSampleUrl:
      "https://images.unsplash.com/photo-1558877085-7835154371bb?w=800&auto=format&fit=crop&q=80",
    qcPrintFileUrl:
      "https://images.unsplash.com/photo-1558877085-7835154371bb?w=800&auto=format&fit=crop&q=80",
    isHandedOffToPacking: true,
    handedOffAt: "2026-10-09 11:30",
    handedOffBy: "Hoàng Minh (Thủ kho)",
    status: "Completed",
    dueDate: "2026-10-07",
    isOverdue: false,
    priority: "NORMAL",
    reprintRound: 1,
  },
];

class InMemoryWorkshopRepo {
  private orders: WorkshopLSX[] = [...INITIAL_WORKSHOP_ORDERS];
  private barcodeRegistry: Record<string, RegisteredBarcode> = { ...INITIAL_BARCODE_REGISTRY };

  getBarcodeRegistry(): RegisteredBarcode[] {
    return Object.values(this.barcodeRegistry);
  }

  resolveBarcode(barcode: string): RegisteredBarcode | null {
    const trimmed = barcode.trim();
    return this.barcodeRegistry[trimmed] || null;
  }

  getOrders(params?: { status?: string; search?: string }): WorkshopLSX[] {
    let list = [...this.orders];
    if (params?.status && params.status !== "ALL") {
      list = list.filter((o) => o.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (o) =>
          o.code.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.blankSku.toLowerCase().includes(q) ||
          (o.orderCode && o.orderCode.toLowerCase().includes(q)),
      );
    }
    return list;
  }

  getOrderById(id: string): WorkshopLSX | undefined {
    return this.orders.find((o) => o.id === id || o.code === id);
  }

  // SCRUM-410: Blank scan screen (Exact registry resolution + BR-PRD-03)
  issueBlanksWithBarcode(
    lsxId: string,
    barcode: string,
    quantity: number,
  ): {
    success: boolean;
    error?: string;
    message?: string;
    order?: WorkshopLSX;
    resolvedBarcode?: RegisteredBarcode;
  } {
    const trimmed = barcode.trim();
    if (!trimmed) {
      return { success: false, error: "Vui lòng quét hoặc nhập mã vạch phôi!" };
    }

    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
      return { success: false, error: "Số lượng xuất phôi phải là số nguyên dương lớn hơn 0!" };
    }

    const registered = this.resolveBarcode(trimmed);
    if (!registered) {
      return {
        success: false,
        error: `LỖI MÃ VẠCH KHÔNG TỒN TẠI: Mã vạch "${trimmed}" không có trong danh mục tem kho phôi! Hệ thống từ chối mọi mã không xác thực.`,
      };
    }

    if (registered.status === "DEPLETED" || registered.availableQty <= 0) {
      return {
        success: false,
        error: `LỖI LÔ PHÔI ĐÃ HẾT: Lô phôi ${registered.lotNumber} (${registered.warehouseLocation}) có tồn khả dụng bằng 0!`,
      };
    }

    if (registered.status === "QUARANTINED") {
      return {
        success: false,
        error: `LỖI LÔ PHÔI CÁCH LY: Lô phôi ${registered.lotNumber} đang kiểm tra chất lượng cách ly, không được phép xuất!`,
      };
    }

    const order = this.getOrderById(lsxId);
    if (!order) {
      return { success: false, error: "Không tìm thấy lệnh sản xuất chỉ định." };
    }

    // Exact SKU match (BR-PRD-03 requirement)
    if (registered.blankSku !== order.blankSku) {
      return {
        success: false,
        error: `LỖI SAI CHỦNG LOẠI PHÔI: Mã tem thuộc SKU "${registered.blankSku}" (${registered.blankName}), KHÔNG KHỚP với phôi yêu cầu "${order.blankSku}" (${order.blankName}) của lệnh ${order.code}!`,
      };
    }

    const remainingRequired = order.plannedQuantity - order.scannedBlanksQuantity;
    if (quantity > remainingRequired) {
      return {
        success: false,
        error: `BR-PRD-03: Lỗi xuất vượt định mức! LSX chỉ cần thêm ${remainingRequired.toLocaleString()} phôi, không thể xuất ${quantity.toLocaleString()} phôi.`,
      };
    }

    if (quantity > registered.availableQty) {
      return {
        success: false,
        error: `LỖI VƯỢT TỒN KHO LÔ PHÔI: Số lượng xuất (${quantity}) vượt quá tồn kho khả dụng tại lô ${registered.lotNumber} (Hiện có: ${registered.availableQty.toLocaleString()} phôi).`,
      };
    }

    // Deduct lot quantity and advance LSX
    registered.availableQty -= quantity;
    if (registered.availableQty === 0) {
      registered.status = "DEPLETED";
    }

    order.scannedBlanksQuantity += quantity;
    if (order.scannedBlanksQuantity >= order.plannedQuantity) {
      order.isBlanksCompleted = true;
      order.status = "Material Issued"; // Ready -> Material Issued
    }

    return {
      success: true,
      message: `Quét xuất phôi thành công! Lô: ${registered.lotNumber} | Vị trí: ${registered.warehouseLocation} | +${quantity.toLocaleString()} phôi (Đã xuất: ${order.scannedBlanksQuantity.toLocaleString()}/${order.plannedQuantity.toLocaleString()}).`,
      order,
      resolvedBarcode: registered,
    };
  }

  // Hoàn tác lượt quét phôi gần nhất
  rollbackIssuedBlanks(
    lsxId: string,
    quantityToRollback: number,
    barcode?: string,
  ): { success: boolean; message: string; order?: WorkshopLSX } {
    const order = this.getOrderById(lsxId);
    if (!order) return { success: false, message: "Không tìm thấy lệnh sản xuất" };

    const rollbackQty = Math.min(quantityToRollback, order.scannedBlanksQuantity);
    order.scannedBlanksQuantity -= rollbackQty;
    order.isBlanksCompleted = false;
    if (order.status === "Material Issued") {
      order.status = "Ready";
    }

    if (barcode) {
      const registered = this.resolveBarcode(barcode);
      if (registered) {
        registered.availableQty += rollbackQty;
        if (registered.status === "DEPLETED") {
          registered.status = "AVAILABLE";
        }
      }
    }

    return {
      success: true,
      message: `Đã hoàn tác -${rollbackQty} phôi cho lệnh ${order.code}.`,
      order,
    };
  }

  // Legacy compatibility
  scanBlanks(
    lsxId: string,
    quantityToScan: number,
  ): { success: boolean; message: string; order?: WorkshopLSX } {
    const order = this.getOrderById(lsxId);
    if (!order) return { success: false, message: "Không tìm thấy lệnh sản xuất" };

    const remainingRequired = order.plannedQuantity - order.scannedBlanksQuantity;
    if (quantityToScan > remainingRequired) {
      return {
        success: false,
        message: `BR-PRD-03: Lỗi xuất vượt! LSX chỉ cần thêm ${remainingRequired} phôi, không thể xuất ${quantityToScan} phôi.`,
      };
    }

    order.scannedBlanksQuantity += quantityToScan;
    if (order.scannedBlanksQuantity >= order.plannedQuantity) {
      order.isBlanksCompleted = true;
      order.status = "Material Issued";
    }

    return {
      success: true,
      message: `Đã quét thành công ${quantityToScan} phôi cho lệnh ${order.code}. Hiện đã xuất: ${order.scannedBlanksQuantity}/${order.plannedQuantity}.`,
      order,
    };
  }

  // SCRUM-417: Kanban print start
  startPrint(lsxId: string, machineId: string): WorkshopLSX {
    const order = this.getOrderById(lsxId);
    if (!order) throw new Error("Order not found");
    order.machineId = machineId;
    order.status = "Printing";
    return order;
  }

  // SCRUM-417: Record printed output & scrap (BR-PRD-04)
  recordPrintOutput(
    lsxId: string,
    goodQty: number,
    scrapQty: number,
    scrapReason?: string,
  ): WorkshopLSX {
    const order = this.getOrderById(lsxId);
    if (!order) throw new Error("Order not found");

    if (scrapQty > 0 && !scrapReason?.trim()) {
      throw new Error("BR-PRD-04: Phôi hỏng (phế phẩm) bắt buộc phải có lý do điều chỉnh kho.");
    }

    order.printedGoodQuantity += goodQty;
    order.printedScrapQuantity += scrapQty;

    if (scrapQty > 0 && scrapReason) {
      order.scrapReasons.push({
        reason: scrapReason,
        quantity: scrapQty,
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
        recordedBy: "Thợ in ca trực",
      });
    }

    // Chuyển sang QC kiểm định
    order.status = "QC";
    return order;
  }

  // SCRUM-419: QC Inspection
  recordQcInspection(
    lsxId: string,
    passQty: number,
    failQty: number,
    failReason?: string,
  ): WorkshopLSX {
    const order = this.getOrderById(lsxId);
    if (!order) throw new Error("Order not found");

    order.qcPassedQuantity += passQty;
    order.qcFailedQuantity += failQty;

    if (failQty > 0 && failReason) {
      order.qcScrapReasons.push({
        reason: failReason,
        quantity: failQty,
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
      });
    }

    // Đủ số lượng pass -> Completed
    if (order.qcPassedQuantity >= order.plannedQuantity) {
      order.status = "Completed";
    } else {
      // Thiếu số lượng sau QC -> Vòng in bù (Reprint loop): quay lại Ready
      order.reprintRound += 1;
      order.status = "Ready";
    }

    return order;
  }

  // SCRUM-412: Handoff to packing
  confirmHandoffToPacking(lsxId: string, actor: string): WorkshopLSX {
    const order = this.getOrderById(lsxId);
    if (!order) throw new Error("Order not found");
    order.isHandedOffToPacking = true;
    order.handedOffAt = new Date().toISOString().replace("T", " ").substring(0, 16);
    order.handedOffBy = actor;
    return order;
  }

  // SCRUM-416: Metrics
  getMetrics(): WorkshopMetrics {
    const totalActive = this.orders.filter((o) => o.status !== "Completed").length;
    const ready = this.orders.filter((o) => o.status === "Ready").length;
    const materialIssued = this.orders.filter((o) => o.status === "Material Issued").length;
    const printing = this.orders.filter((o) => o.status === "Printing").length;
    const qc = this.orders.filter((o) => o.status === "QC").length;
    const completedToday = this.orders.filter((o) => o.status === "Completed").length;
    const overdue = this.orders.filter((o) => o.isOverdue).length;

    const totalPrinted = this.orders.reduce(
      (acc, o) => acc + o.printedGoodQuantity + o.printedScrapQuantity,
      0,
    );
    const totalScrap = this.orders.reduce(
      (acc, o) => acc + o.printedScrapQuantity + o.qcFailedQuantity,
      0,
    );
    const scrapRate = totalPrinted > 0 ? (totalScrap / totalPrinted) * 100 : 1.8;

    return {
      totalActiveOrders: totalActive,
      readyOrdersCount: ready,
      materialIssuedCount: materialIssued,
      printingCount: printing,
      qcPendingCount: qc,
      completedTodayCount: completedToday,
      overdueOrdersCount: overdue,
      scrapRatePercent: Number(scrapRate.toFixed(1)),
      pendingSampleApprovalCount: 2,
    };
  }
}

export const workshopRepo = new InMemoryWorkshopRepo();

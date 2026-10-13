import { SampleRequest, ProductionOrder } from "./types";

const INITIAL_SAMPLES: SampleRequest[] = [
  {
    id: "smp-001",
    code: "SMP-2026-001",
    customerName: "Công ty Cổ phần Cà phê Highland Heritage",
    customerCode: "CUST-HLH-09",
    customerEmail: "procurement@highlandheritage.vn",
    blankSku: "LY-GIAY-350-TRANG",
    blankName: "Ly giấy trơn hai lớp 350ml PE",
    designName: "Logo Mùa Thu Highland Gold 2026",
    designSnapshotUrl:
      "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80",
    printSpec: {
      technology: "In Flexo UV 4 màu",
      colors: ["Pantone 1805C", "Pantone 7549C", "Pantone 426C", "Black"],
      dimensions: "85mm x 115mm (Wrap-around)",
      checksum: "sha256:7b91ca34d56f912e84",
    },
    sampleQuantity: 20,
    dueDate: "2026-10-12",
    linkedQuoteCode: "BG-2026-088",
    roundNumber: 1,
    status: "Sent to Customer",
    history: [
      {
        round: 1,
        status: "Draft",
        timestamp: "2026-10-06 09:15",
        actor: "Hoàng Minh (Sales)",
        comment: "Khởi tạo yêu cầu mẫu đợt 1",
      },
      {
        round: 1,
        status: "Submitted",
        timestamp: "2026-10-06 14:00",
        actor: "Hoàng Minh (Sales)",
        comment: "Chuyển LSX mẫu cho xưởng in",
      },
      {
        round: 1,
        status: "In Production",
        timestamp: "2026-10-07 08:30",
        actor: "Xưởng in Máy 02",
      },
      {
        round: 1,
        status: "Ready",
        timestamp: "2026-10-08 11:20",
        actor: "QC Staff (Kiểm tra đạt chuẩn)",
      },
      {
        round: 1,
        status: "Sent to Customer",
        timestamp: "2026-10-08 15:45",
        actor: "Hoàng Minh (Sales)",
        comment: "Giao qua bưu tá Viettel Post",
      },
    ],
    trackingCode: "VTP-883921094VN",
    carrier: "Viettel Post Express",
  },
  {
    id: "smp-002",
    code: "SMP-2026-002",
    customerName: "Hệ thống Trà sữa Toco Cloud",
    customerCode: "CUST-TOC-12",
    customerEmail: "design@tococloud.com",
    blankSku: "LY-NHUA-PP-500",
    blankName: "Ly nhựa PP mờ sần 500ml",
    designName: "Mẫu Thỏ Trăng Tết Trung Thu",
    designSnapshotUrl:
      "https://images.unsplash.com/photo-1558877085-7835154371bb?w=600&auto=format&fit=crop&q=80",
    printSpec: {
      technology: "In Lưới trực tiếp",
      colors: ["Pantone 219C", "Pantone Reflex Blue"],
      dimensions: "90mm x 90mm (2 mặt)",
      checksum: "sha256:f48a1c900e7221bc",
    },
    sampleQuantity: 15,
    dueDate: "2026-10-14",
    linkedQuoteCode: "BG-2026-092",
    roundNumber: 2,
    status: "Changes Requested",
    history: [
      {
        round: 1,
        status: "Changes Requested",
        timestamp: "2026-10-05 16:30",
        actor: "Khách hàng Toco Cloud",
        comment: "Màu hồng Pantone 219C bị nhạt so với bản phối cảnh, cần pha đậm thêm 10%.",
      },
      {
        round: 2,
        status: "Draft",
        timestamp: "2026-10-06 08:00",
        actor: "Hoàng Minh (Sales)",
        comment: "Bắt đầu vòng duyệt 2 theo phản hồi khách",
      },
    ],
    customerFeedback: "Màu hồng Pantone 219C bị nhạt so với bản phối cảnh, cần pha đậm thêm 10%.",
  },
  {
    id: "smp-003",
    code: "SMP-2026-003",
    customerName: "Tập đoàn F&B Golden Spoon",
    customerCode: "CUST-GSP-03",
    customerEmail: "order@goldenspoon.vn",
    blankSku: "TO-GIAY-750-KRAFT",
    blankName: "Tô giấy Kraft 750ml chống thấm",
    designName: "Nhãn Tô Kraft Takeaway Golden",
    designSnapshotUrl:
      "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=600&auto=format&fit=crop&q=80",
    printSpec: {
      technology: "In Offset 4 màu",
      colors: ["CMYK"],
      dimensions: "140mm x 75mm",
      checksum: "sha256:a123bc456def7890",
    },
    sampleQuantity: 30,
    dueDate: "2026-10-18",
    linkedQuoteCode: "BG-2026-104",
    roundNumber: 1,
    status: "Approved",
    history: [
      {
        round: 1,
        status: "Approved",
        timestamp: "2026-10-09 10:15",
        actor: "Khách hàng Golden Spoon",
        comment: "Mẫu in sắc nét, phôi chuẩn. Phê duyệt để tiến hành sản xuất đơn hàng.",
      },
    ],
    approvedAt: "2026-10-09 10:15",
  },
];

const INITIAL_PRODUCTION_ORDERS: ProductionOrder[] = [
  {
    id: "lsx-001",
    code: "LSX-2026-1001",
    type: "SAMPLE",
    status: "Pending Prepress",
    sourceId: "smp-001",
    customerName: "Công ty Cổ phần Cà phê Highland Heritage",
    blankSku: "LY-GIAY-350-TRANG",
    blankName: "Ly giấy trơn hai lớp 350ml PE",
    plannedQuantity: 20,
    issuedQuantity: 0,
    goodQuantity: 0,
    scrapQuantity: 0,
    dueDate: "2026-10-12",
    createdAt: "2026-10-06 14:00",
    prepressArtifact: {
      fileName: "Highland_Gold_Cup_350ml_PrintReady_v1.pdf",
      fileSize: "18.4 MB",
      checksum: "sha256:7b91ca34d56f912e84",
      downloadUrl: "#mock-download",
      previewUrl:
        "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80",
      colorSeparation: ["C", "M", "Y", "K", "Spot Gold 871C"],
      dimensions: "85mm x 115mm (3mm bleed)",
      resolutionDpi: 300,
    },
    holdHistory: [],
  },
  {
    id: "lsx-002",
    code: "LSX-2026-1002",
    type: "ORDER",
    status: "Ready",
    sourceId: "ord-line-8841",
    orderCode: "SO-2026-0412",
    customerName: "Tập đoàn F&B Golden Spoon",
    blankSku: "TO-GIAY-750-KRAFT",
    blankName: "Tô giấy Kraft 750ml chống thấm",
    plannedQuantity: 5000,
    issuedQuantity: 0,
    goodQuantity: 0,
    scrapQuantity: 0,
    dueDate: "2026-10-15",
    createdAt: "2026-10-08 09:30",
    prepressCheckedAt: "2026-10-08 14:20",
    prepressCheckResult: "PASS",
    prepressNotes:
      "Đã khớp checksum với bản mẫu SMP-2026-003 đã được khách duyệt. File in đạt chuẩn.",
    prepressArtifact: {
      fileName: "GoldenSpoon_Kraft750_MasterPrint.pdf",
      fileSize: "32.1 MB",
      checksum: "sha256:a123bc456def7890",
      downloadUrl: "#mock-download",
      previewUrl:
        "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&auto=format&fit=crop&q=80",
      colorSeparation: ["CMYK"],
      dimensions: "140mm x 75mm",
      resolutionDpi: 300,
    },
    holdHistory: [],
  },
  {
    id: "lsx-003",
    code: "LSX-2026-1003",
    type: "ORDER",
    status: "Printing",
    sourceId: "ord-line-8849",
    orderCode: "SO-2026-0419",
    customerName: "Chuỗi Cà phê The Daily Bean",
    blankSku: "LY-GIAY-500-KRAFT",
    blankName: "Ly giấy Kraft 500ml",
    plannedQuantity: 10000,
    issuedQuantity: 10000,
    goodQuantity: 4200,
    scrapQuantity: 150,
    dueDate: "2026-10-14",
    createdAt: "2026-10-07 10:15",
    prepressCheckedAt: "2026-10-07 11:00",
    prepressCheckResult: "PASS",
    prepressArtifact: {
      fileName: "DailyBean_500ml_Flexo.pdf",
      fileSize: "12.8 MB",
      checksum: "sha256:8812ffaa994101",
      downloadUrl: "#mock-download",
      previewUrl:
        "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop&q=80",
      colorSeparation: ["Pantone 469C", "Pantone Warm Gray 1C"],
      dimensions: "90mm x 135mm",
      resolutionDpi: 300,
    },
    holdHistory: [],
  },
  {
    id: "lsx-004",
    code: "LSX-2026-1004",
    type: "ORDER",
    status: "On Hold",
    previousStatus: "Ready",
    sourceId: "ord-line-8855",
    orderCode: "SO-2026-0422",
    customerName: "Trà sữa Phúc Long Retail",
    blankSku: "LY-NHUA-PET-700",
    blankName: "Ly nhựa PET trong 700ml",
    plannedQuantity: 8000,
    issuedQuantity: 0,
    goodQuantity: 0,
    scrapQuantity: 0,
    dueDate: "2026-10-16",
    createdAt: "2026-10-08 16:00",
    holdReason:
      "Phát hiện file in sai kích thước tràn viền (Bleed chỉ có 1mm thay vì chuẩn 3mm). Đang chờ Sales liên hệ khách gửi lại file.",
    prepressArtifact: {
      fileName: "PhucLong_PET700_Halloween.pdf",
      fileSize: "24.5 MB",
      checksum: "sha256:dd12349912bcce",
      downloadUrl: "#mock-download",
      previewUrl:
        "https://images.unsplash.com/photo-1558877085-7835154371bb?w=800&auto=format&fit=crop&q=80",
      colorSeparation: ["CMYK"],
      dimensions: "95mm x 150mm",
      resolutionDpi: 300,
    },
    holdHistory: [
      {
        timestamp: "2026-10-09 08:30",
        actor: "Trần Anh (Prepress Staff)",
        reason: "File in sai kích thước tràn viền (Bleed chỉ 1mm). Tạm dừng để sửa file.",
        type: "HOLD",
      },
    ],
  },
];

class InMemorySamplesProductionRepo {
  private samples: SampleRequest[] = [...INITIAL_SAMPLES];
  private productionOrders: ProductionOrder[] = [...INITIAL_PRODUCTION_ORDERS];

  // SAMPLES API
  getSampleRequests(params?: { status?: string; search?: string }): SampleRequest[] {
    let list = [...this.samples];
    if (params?.status && params.status !== "ALL") {
      list = list.filter((s) => s.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (s) =>
          s.code.toLowerCase().includes(q) ||
          s.customerName.toLowerCase().includes(q) ||
          s.blankSku.toLowerCase().includes(q),
      );
    }
    return list;
  }

  getSampleRequestById(id: string): SampleRequest | undefined {
    return this.samples.find((s) => s.id === id || s.code === id);
  }

  createSampleRequest(
    data: Omit<SampleRequest, "id" | "code" | "roundNumber" | "status" | "history">,
  ): SampleRequest {
    const count = this.samples.length + 1;
    const code = `SMP-2026-${String(count).padStart(3, "0")}`;
    const newSample: SampleRequest = {
      ...data,
      id: `smp-${Date.now()}`,
      code,
      roundNumber: 1,
      status: "Draft",
      history: [
        {
          round: 1,
          status: "Draft",
          timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
          actor: "Nhân viên Sales",
          comment: "Khởi tạo yêu cầu mẫu",
        },
      ],
    };
    this.samples.unshift(newSample);
    return newSample;
  }

  submitSampleRequest(id: string): SampleRequest {
    const sample = this.getSampleRequestById(id);
    if (!sample) throw new Error("Sample request not found");
    sample.status = "Submitted";
    sample.history.push({
      round: sample.roundNumber,
      status: "Submitted",
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
      actor: "Nhân viên Sales",
      comment: "Đã gửi xưởng sản xuất mẫu thử",
    });

    // Tự động tạo LSX kiểu SAMPLE (BR-PRD-01)
    const lsxCount = this.productionOrders.length + 1;
    const lsx: ProductionOrder = {
      id: `lsx-${Date.now()}`,
      code: `LSX-2026-${1000 + lsxCount}`,
      type: "SAMPLE",
      status: "Pending Prepress",
      sourceId: sample.id,
      customerName: sample.customerName,
      blankSku: sample.blankSku,
      blankName: sample.blankName,
      plannedQuantity: sample.sampleQuantity,
      issuedQuantity: 0,
      goodQuantity: 0,
      scrapQuantity: 0,
      dueDate: sample.dueDate,
      createdAt: new Date().toISOString().replace("T", " ").substring(0, 16),
      prepressArtifact: {
        fileName: `${sample.blankSku}_PrintSpec_R${sample.roundNumber}.pdf`,
        fileSize: "14.2 MB",
        checksum: sample.printSpec.checksum,
        downloadUrl: "#mock-download",
        previewUrl: sample.designSnapshotUrl,
        colorSeparation: sample.printSpec.colors,
        dimensions: sample.printSpec.dimensions,
        resolutionDpi: 300,
      },
      holdHistory: [],
    };
    this.productionOrders.unshift(lsx);

    return sample;
  }

  recordSentToCustomer(id: string, carrier: string, trackingCode: string): SampleRequest {
    const sample = this.getSampleRequestById(id);
    if (!sample) throw new Error("Sample request not found");
    sample.status = "Sent to Customer";
    sample.carrier = carrier;
    sample.trackingCode = trackingCode;
    sample.history.push({
      round: sample.roundNumber,
      status: "Sent to Customer",
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
      actor: "Nhân viên Sales / Giao hàng",
      comment: `Đã gửi mẫu qua ${carrier} (Mã vận đơn: ${trackingCode})`,
    });
    return sample;
  }

  customerApprove(id: string, comment?: string): SampleRequest {
    const sample = this.getSampleRequestById(id);
    if (!sample) throw new Error("Sample request not found");
    sample.status = "Approved";
    sample.approvedAt = new Date().toISOString().replace("T", " ").substring(0, 16);
    sample.history.push({
      round: sample.roundNumber,
      status: "Approved",
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
      actor: `Khách hàng (${sample.customerName})`,
      comment: comment || "Khách hàng phê duyệt mẫu in đạt yêu cầu",
    });
    return sample;
  }

  customerRequestChanges(id: string, feedback: string): SampleRequest {
    const sample = this.getSampleRequestById(id);
    if (!sample) throw new Error("Sample request not found");
    sample.status = "Changes Requested";
    sample.customerFeedback = feedback;
    sample.history.push({
      round: sample.roundNumber,
      status: "Changes Requested",
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
      actor: `Khách hàng (${sample.customerName})`,
      comment: feedback,
    });
    // Tăng vòng duyệt roundNumber
    sample.roundNumber += 1;
    return sample;
  }

  // PRODUCTION ORDERS API
  getProductionOrders(params?: {
    type?: string;
    status?: string;
    search?: string;
  }): ProductionOrder[] {
    let list = [...this.productionOrders];
    if (params?.type && params.type !== "ALL") {
      list = list.filter((p) => p.type === params.type);
    }
    if (params?.status && params.status !== "ALL") {
      list = list.filter((p) => p.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.code.toLowerCase().includes(q) ||
          p.customerName.toLowerCase().includes(q) ||
          p.blankSku.toLowerCase().includes(q) ||
          (p.orderCode && p.orderCode.toLowerCase().includes(q)),
      );
    }
    return list;
  }

  getProductionOrderById(id: string): ProductionOrder | undefined {
    return this.productionOrders.find((p) => p.id === id || p.code === id);
  }

  prepressCheck(id: string, pass: boolean, notes: string): ProductionOrder {
    const po = this.getProductionOrderById(id);
    if (!po) throw new Error("Production order not found");
    po.prepressCheckedAt = new Date().toISOString().replace("T", " ").substring(0, 16);
    po.prepressCheckResult = pass ? "PASS" : "FAIL";
    po.prepressNotes = notes;

    if (pass) {
      po.status = "Ready";
    } else {
      po.previousStatus = po.status;
      po.status = "On Hold";
      po.holdReason = `Prepress không đạt: ${notes}`;
      po.holdHistory.push({
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
        actor: "Kỹ thuật viên Prepress",
        reason: notes,
        type: "HOLD",
      });
    }
    return po;
  }

  holdProductionOrder(id: string, reason: string): ProductionOrder {
    const po = this.getProductionOrderById(id);
    if (!po) throw new Error("Production order not found");
    po.previousStatus = po.status;
    po.status = "On Hold";
    po.holdReason = reason;
    po.holdHistory.push({
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
      actor: "Quản đốc xưởng",
      reason,
      type: "HOLD",
    });
    return po;
  }

  resumeProductionOrder(id: string): ProductionOrder {
    const po = this.getProductionOrderById(id);
    if (!po) throw new Error("Production order not found");
    po.status = po.previousStatus || "Ready";
    po.holdHistory.push({
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
      actor: "Quản đốc xưởng",
      reason: "Đã khắc phục sự cố, tiếp tục lệnh sản xuất",
      type: "RESUME",
    });
    po.holdReason = undefined;
    return po;
  }

  cancelProductionOrder(id: string, reason: string): ProductionOrder {
    const po = this.getProductionOrderById(id);
    if (!po) throw new Error("Production order not found");
    const prevStatus = po.status;
    po.status = "Cancelled";
    po.cancellationReason = reason;

    // Tính toán outcome theo chính sách BR-PRD-10
    if (
      prevStatus === "Pending Prepress" ||
      prevStatus === "Ready" ||
      prevStatus === "Material Issued"
    ) {
      po.cancellationPolicyOutcome =
        "Hủy trước in: Hoàn trả 100% phôi đã xuất về kho lưu trữ. Không phát sinh chi phí in phế.";
    } else {
      po.cancellationPolicyOutcome =
        "Hủy trong khi in: Toàn bộ sản phẩm dở dang (" +
        po.goodQuantity +
        " sản phẩm) và phôi hỏng (" +
        po.scrapQuantity +
        " phôi) được tính chi phí phế phẩm. Báo cáo kế toán ghi nhận chi phí phạt vi phạm hợp đồng.";
    }
    return po;
  }
}

export const samplesProductionRepo = new InMemorySamplesProductionRepo();

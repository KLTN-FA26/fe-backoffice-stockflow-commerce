/**
 * Nhãn màn nhận hàng của phiếu nhập hàng hoàn theo yêu cầu trả hàng (WF-05 BE-22, Q-11, Q-18, Q-4): nhận theo số lượng
 * SKU đã duyệt, thùng của chuyến chỉ là ứng viên. Tách khỏi `labels-return.ts` cho dễ tra.
 */

import type { ReturnCartonEligibility } from "./returns";

export const RETURN_RECEIVING_LABELS = {
  progress: {
    title: "Hàng được duyệt trả",
    description:
      "Nhận theo số lượng đã duyệt của từng SKU — thùng nào của chuyến khách gửi về cũng được, miễn số lượng còn trong phạm vi duyệt.",
    sku: "SKU",
    approved: "Đã duyệt",
    confirmed: "Đã nhận (phiếu trước)",
    currentDraft: "Đã ghi trên phiếu này",
    currentClosed: "Nhận trên phiếu này",
    remaining: "Còn nhận được",
    bar: (sku: string, percent: number) => `Tiến độ nhận ${sku}: ${percent}%`,
    none: "Yêu cầu chưa có dòng nào được duyệt.",
    // Chưa xác nhận phiếu thì yêu cầu chưa sang "Hàng đã về" — không nói như đã nhận
    countedAwaitingConfirmation:
      "Đã ghi đủ số lượng được duyệt trên phiếu nháp. Hàng chỉ được tính là đã nhận sau khi xác nhận phiếu.",
    complete: "Đã nhận đủ số lượng được duyệt.",
    draftNote:
      "Số “Đã ghi trên phiếu này” là số đang đếm trên phiếu nháp, chưa phải hàng đã nhận chính thức.",
  },
  candidates: {
    title: "Thùng có thể nhận",
    description:
      "Thùng của chuyến thuộc SKU được duyệt và còn nhận được. Chọn thùng thực tế đang có trước mặt — chọn không có nghĩa là hàng đã về.",
    empty:
      "Không còn thùng nào nhận được: số đã duyệt đã đủ, hoặc không thùng nào của chuyến còn hợp lệ.",
    lpn: "LPN",
    sku: "SKU",
    lot: "Lô",
    label: "SL nhãn",
    status: "Ghi chú nhận",
    select: "Chọn",
    selectLpn: (lpn: string) => `Chọn thùng ${lpn}`,
    receivable: "Nhận nguyên thùng",
    countRequired: (max: number) => `Phải mở đếm — tối đa ${max}`,
    excludedTitle: (count: number) => `Thùng không nhận được (${count})`,
    excludedHint: "Tham khảo: các thùng này không ghi vào phiếu.",
  },
  selected: {
    title: "Thùng đã chọn",
    summary: (lpn: string, sku: string, label: number) => `${lpn} · ${sku} · nhãn ${label}`,
    countRequiredHint: (max: number) =>
      `Nhãn thùng vượt số còn nhận được (${max}). Chỉ nhận được khi thùng đã mở: đếm thực tế rồi nhập số đếm, tối đa ${max}. Thùng còn nguyên — để riêng, giữ hộ khách.`,
    confirmHint:
      "Kiểm tra thùng thực tế: ghi tình trạng, đánh dấu “Thùng đã mở” và nhập số đếm nếu thùng đã bị mở, rồi bấm “Ghi nhận thùng”.",
    record: "Ghi nhận thùng",
    clear: "Bỏ chọn",
    countedAboveMax: (max: number) =>
      `Số đếm vượt số còn nhận được (${max}). Phần vượt giữ hộ khách, báo Sale ghi biên nhận.`,
    sealedNotAllowed: (max: number) =>
      `Thùng nguyên vượt số còn nhận được (${max}). Nếu thùng đã mở, đánh dấu “Thùng đã mở” và nhập số đếm thực tế; nếu còn nguyên, để riêng giữ hộ khách.`,
  },
  recorded: {
    count: (cartons: number) => `Đã ghi ${cartons} thùng`,
  },
  // WF-05 Q-11: chuyến hoàn về nhiều lần — thùng đã về ở phiếu trước không phải thùng thiếu
  earlier: {
    state: "Đã về ở phiếu trước",
    note: (count: number) =>
      `${count} thùng của nguồn đã về trên phiếu trước, không tính là thiếu.`,
  },
  loose: {
    skuPlaceholder: "Chọn SKU được duyệt",
    remaining: (n: number) => `Còn nhận được: ${n}`,
    noRemaining: "SKU này đã đủ số được duyệt.",
  },
  eligibility: {
    RECEIVABLE: "Nhận nguyên thùng",
    COUNT_REQUIRED: "Phải mở đếm",
    ON_THIS_RECEIPT: "Đã trên phiếu này",
    SKU_NOT_APPROVED: "SKU không được duyệt trả",
    APPROVED_QUANTITY_REACHED: "SKU đã đủ số duyệt",
    IN_WAREHOUSE: "Đã về kho (phiếu trước) hoặc chưa rời kho",
    RETURNED_OPENED: "Đã về mở thùng trước đây — đã huỷ",
    CUSTOMER_GOODS: "Hàng của khách đang giữ hộ",
    NOT_FOUND: "Không có trong sổ kho",
    UNKNOWN: "Không rõ",
  } satisfies Record<ReturnCartonEligibility | "UNKNOWN", string>,
  errors: {
    skuNotApproved:
      "SKU của thùng này không được duyệt trả: không ghi vào phiếu. Để riêng, giữ hộ khách và báo Sale ghi biên nhận trên yêu cầu trả hàng.",
    aboveRemaining: (units: number, remaining: number) =>
      `Thùng mang ${units} đơn vị nhưng chỉ còn nhận được ${remaining}. Thùng không được chia: nếu đã mở, nhập số đếm thực tế; phần vượt giữ hộ khách.`,
    alreadyReceived: "Thùng này đã về kho trên một phiếu trước — không nhận lại.",
    returnedOpened: "Thùng này từng về ở trạng thái đã mở và đã bị huỷ — không nhận lại.",
    customerGoods:
      "Thùng này là hàng của khách đang giữ hộ (yêu cầu trước không hoàn tiền) — không nhận vào phiếu.",
  },
} as const;

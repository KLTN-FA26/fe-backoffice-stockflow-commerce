/**
 * Câu tiếng Việt khi nạp, đo và kiểm file 3D `.glb` của cấu hình in (module 12). Chép nguyên văn từ
 * storefront (`engine/model3d/*`), nơi các câu này đã được review cho người dựng model. Hàm dựng câu
 * nhận giá trị thuần (tầng `constants` không import gì từ phần còn lại của `src/`).
 */

const mm = (n: number) => `${Math.round(n * 10) / 10} mm`;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Câu báo lỗi khi đo model (mỗi câu gắn một `ModelIssueCode`). */
export const MODEL3D_ISSUE_MESSAGES = {
  noPrintMesh: () =>
    "Không tìm thấy phần in nào. Model cần ít nhất một object tên print:BODY (ly) hoặc print:FRONT, print:BACK, print:LEFT, print:RIGHT (túi).",
  invalidGeometry: (name: string, reason: string) => `${name} không dùng được: ${reason}.`,
  coneCloses: (name: string, where: "base" | "rim") =>
    where === "base"
      ? `Mặt nón của ${name} đóng lại trước khi tới đáy (Y = 0), không dựng được cả ly từ dải này.`
      : `Mặt nón của ${name} đóng lại trước khi tới miệng ly, không dựng được cả ly từ dải này.`,
  facesInward: (name: string) =>
    `Mặt của ${name} đang quay vào trong nên sẽ hiện như một lỗ trên model. Trong Blender: vào Edit Mode, chọn tất cả (A), rồi Mesh > Normals > Recalculate Outside.`,
  nameNearMiss: (name: string, expected: string) =>
    `Object "${name}" trông như phần in nhưng tên chưa đúng, nên không được nhận. Hãy đặt tên chính xác là "${expected}" (Blender tự thêm .001 khi hai object trùng tên).`,
  printOnParent: (name: string) =>
    `${name} đang đặt trên một object cha chứa các phần in khác. Hãy đặt tên print: cho chính object mesh, không đặt cho object chứa chúng.`,
  multiMaterial: (name: string) =>
    `${name} có nhiều vật liệu: dùng một vật liệu cho phần in (một object chỉ gồm một mesh).`,
  gussetMismatch: (sideName: string, sideMm: number, planesMm: number) =>
    `Độ sâu hông đo từ ${sideName} là ${mm(sideMm)}, nhưng khoảng cách giữa mặt trước và mặt sau là ${mm(planesMm)} (cho phép lệch 0,5 mm). Số đo lấy theo mặt hông.`,
  bagIncomplete: () =>
    "Chưa đủ mặt để đo cả túi: cần print:FRONT và print:BACK, hoặc một mặt hông (print:LEFT / print:RIGHT) cùng mặt trước hoặc sau. Kích thước từng mặt vẫn đọc được.",
  duplicatePrintMesh: (name: string) =>
    `Có nhiều hơn một object tên ${name}. Mỗi vùng in chỉ được có một object.`,
  mixedKinds: () =>
    "Model vừa có print:BODY (ly) vừa có mặt túi (print:FRONT, BACK, LEFT, RIGHT). Mỗi model chỉ là ly hoặc túi.",
  badUnits: (name: string, heightMm: number, [min, max]: readonly [number, number]) =>
    `Chiều cao của ${name} đọc ra ${mm(heightMm)}, ngoài khoảng ${min}–${max} mm. Có thể file dựng sai đơn vị (cần 1 đơn vị = 1 mét).`,
  notRevolved: (name: string, detail: string) =>
    `${name} không phải mặt tròn xoay khép kín quanh trục Y đi qua gốc tọa độ (${detail}; cho phép 0,5 mm). Phần in của ly phải là một vòng khép kín hình nón cụt có tâm ở trục Y.`,
  tooCoarse: (name: string, edges: number, min: number) =>
    `${name} chỉ có ${edges} cạnh quanh thân, cần ít nhất ${min}. Hãy tăng số cạnh để thân ly tròn.`,
  notPlanar: (name: string, deviationMm: number) =>
    `${name} không phẳng (các điểm lệch nhau ${mm(deviationMm)}, cho phép 0,5 mm). Mặt túi phải nằm trên một mặt phẳng, mặt trước/sau vuông góc trục Z, mặt hông vuông góc trục X.`,
  notRectangular: (name: string) =>
    `${name} không phải hình chữ nhật (sai số quá 0,5 mm). Mặt in của túi phải là hình chữ nhật.`,
  tooManyTriangles: (count: number, max: number) =>
    `Model có ${count} tam giác, nhiều hơn mức cho phép ${max}. Hãy giảm độ chi tiết của model.`,
  fileTooLarge: (bytes: number, maxBytes: number) =>
    `File nặng ${Math.round((bytes / 1024 / 1024) * 10) / 10} MB, vượt mức ${maxBytes / 1024 / 1024} MB.`,
  notFacingFront: (name: string) => `${name} đang quay về -Z. Mặt trước của túi phải nhìn về +Z.`,
  baseNotAtZero: (minYMm: number) =>
    `Đáy model nằm ở Y = ${mm(minYMm)}, cần ở Y = 0. Viewer sẽ đặt model lệch so với mặt sàn.`,
} as const;

/** Phần chi tiết ghép vào câu `notRevolved`, và lý do một mesh in không đo được. */
export const MODEL3D_MEASURE_DETAILS = {
  coneDeviation: (deviationMm: number) =>
    `có điểm lệch ${Math.round(deviationMm * 10) / 10} mm so với mặt nón`,
  zeroRadius: "bán kính vòng bằng 0",
  ringHole: (holeDeg: number) => `vòng bị hở một đoạn ${Math.round(holeDeg)}°`,
  noMesh: "không chứa mesh nào",
  noVertices: "không có đỉnh nào",
  noTriangles: "không có tam giác nào",
  badCoordinates: "có toạ độ không hợp lệ (NaN hoặc vô hạn)",
} as const;

/** Câu khi so một mesh in của file với mẫu (`templateDifferences`). */
export const MODEL3D_DIFFERENCE_MESSAGES = {
  value: (label: string, fileMm: number, templateMm: number) =>
    `${label}: file ${round2(fileMm)} mm, mẫu ${round2(templateMm)} mm`,
  bandTopY: "Y đỉnh thân in",
  bandBottomY: "Y đáy thân in",
  bandTopDiameter: "đường kính đỉnh thân in",
  bandBottomDiameter: "đường kính đáy thân in",
  faceInsteadOfBand: (code: string) => `${code}: file là mặt phẳng, mẫu là thân ly`,
  bandInsteadOfFace: (code: string) => `${code}: file là thân ly, mẫu là mặt túi`,
  faceWidth: (code: string) => `${code} rộng`,
  faceHeight: (code: string) => `${code} cao`,
  faceBaseY: (code: string) => `${code} đáy Y`,
  facePlane: (code: string) => `${code} vị trí mặt`,
  faceOffCentre: (code: string, offMm: number, centreMm: number) =>
    `${code} lệch tâm theo chiều ngang ${round2(offMm)} mm (tâm file ${round2(centreMm)} mm, mẫu 0 mm)`,
} as const;

/** Tên vùng in và mẫu tạm dựng từ model. */
export const MODEL3D_TEMPLATE_LABELS = {
  cupBody: "Thân ly",
  faces: {
    FRONT: "Mặt trước",
    BACK: "Mặt sau",
    LEFT: "Hông trái",
    RIGHT: "Hông phải",
  },
  templateName: "Model đang thử",
} as const;

/** Lỗi khi nạp file `.glb` (`Model3dError`). */
export const MODEL3D_LOAD_MESSAGES = {
  timeout: (reason: string) => `Nạp model 3D quá thời gian chờ 15 giây (${reason})`,
  timeoutDownload: "tải file",
  timeoutParse: "phân tích file",
  http: (status: number) => `Không tải được file .glb (HTTP ${status})`,
  network: (detail: string) => `Không tải được file .glb: ${detail}`,
  aborted: "Việc nạp model 3D đã bị huỷ",
  noScene: "File .glb không có cảnh nào",
  parse: (detail: string) => `Không nạp được file .glb: ${detail}`,
} as const;

/** Cách dựng file, ngắn đủ để đọc trước khi xuất từ Blender (quy ước file 3D, §7; chép từ storefront). */
export const MODEL3D_FILE_CHECKLIST: readonly string[] = [
  "Kích thước thật: 1 đơn vị trong Blender bằng 1 mét (ly cao 110 mm thì ghi 0,11).",
  "Khi xuất, trục Y hướng lên, đáy ở Y = 0, mặt trước nhìn về +Z.",
  "Túi đặt chính giữa gốc toạ độ; ly có tâm đáy ở gốc toạ độ.",
  "Phần in là object riêng, đặt tên đúng: print:BODY (ly) hoặc print:FRONT, print:BACK, print:LEFT, print:RIGHT (túi), không có đuôi .001.",
  "Không để bản sao thân ly nằm dưới phần in: nó sẽ lộ ra qua hình in.",
  "Khi xuất: tích Apply Modifiers; các mặt quay ra ngoài (Recalculate Outside).",
  "Không nén Draco, không animation, nặng tối đa 10 MB.",
];

/** Khi chọn file: không đọc được, quá lớn, quá chậm (chép từ storefront, hợp với `Model3dError.reason`). */
export const MODEL3D_READ_MESSAGES = {
  unreadable:
    "Không đọc được file này như một file .glb. Hãy xuất từ Blender bằng File > Export > glTF 2.0, chọn định dạng glTF Binary (.glb).",
  unreadableCauses:
    "Nguyên nhân thường gặp: không phải file .glb (hoặc file hỏng), file nén kiểu Draco, hoặc thiếu dữ liệu đi kèm.",
  notGlb: (name: string) =>
    `File "${name}" không có đuôi .glb. Chỉ nhận file glTF Binary (.glb), xuất từ Blender bằng File > Export > glTF 2.0.`,
  readFailed: "Không đọc được file từ máy của bạn. Hãy chọn lại file.",
  slowFile:
    "File nặng hoặc phức tạp quá nên đọc quá 15 giây. Hãy giảm số tam giác hoặc dung lượng rồi thử lại.",
  tooBigToRead: (bytes: number, maxBytes: number) =>
    `File nặng ${Math.round((bytes / 1024 / 1024) * 10) / 10} MB nên không được đọc (tối đa ${maxBytes / 1024 / 1024} MB). Quy ước chỉ cho phép file model tối đa 10 MB.`,
  axesNote:
    "Cách đọc: các thông báo dùng trục của file .glb (Y hướng lên, mặt trước về +Z). Trong Blender, trục Z hướng lên và mặt trước nhìn về −Y; khi xuất ra .glb, Blender đổi sang Y lên và mặt trước +Z.",
} as const;

/** Mức của một lỗi kiểm file, bằng chữ (không chỉ bằng màu). */
export const MODEL3D_ISSUE_LEVEL_LABELS = { error: "Lỗi", warning: "Cảnh báo" } as const;

/** Chữ ghi trên lưới đánh số vẽ lên phần in (chép từ `grid-texture.ts` của bộ xem thử ở storefront). */
export const MODEL3D_GRID_LABELS = {
  topEdge: "Mép trên của phần in",
  leftEdge: "Mép trái",
  leftEdgeSeam: "Mép trái / đường nối",
  glueFlap: "Phần dán",
} as const;

/** Chữ của khung xem model 3D có lưới đánh số và của khuôn phẳng đặt cạnh nó (cấu hình in, module 12). */
export const MODEL3D_VIEW_LABELS = {
  title: "Xem thử model với lưới đánh số",
  modelTitle: "Model 3D",
  expand: "Phóng to",
  collapse: "Thu nhỏ",
  intro:
    "Kiểm bằng mắt trước khi lưu: hình in có nằm đúng chỗ, đúng chiều, và đường nối của ly có ở mặt sau không. Số ở ô nào trên model thì tìm đúng số đó trên khuôn phẳng bên dưới.",
  noViewErrors: "Chưa hiện model 3D vì file còn lỗi: sửa trong Blender rồi chọn lại file.",
  noViewBag: "Chưa hiện model 3D vì chưa đủ mặt để dựng cả túi từ file này.",
  noViewDefaults:
    "Chưa vẽ được lưới với các giá trị lề hoặc đường nối hiện tại: kiểm tra lại mục Nâng cao.",
  loading: "Đang dựng model 3D…",
  canvas: "Model 3D của file, có lưới đánh số trên từng phần in. Kéo để xoay, cuộn để phóng to.",
  noWebGlTitle: "Trình duyệt này không hiện được 3D.",
  noWebGlText:
    "Bạn vẫn xem được số đo, lỗi và khuôn phẳng bên dưới. Thử trình duyệt khác hoặc bật tăng tốc phần cứng.",
  stoppedTitle: "Model 3D đã dừng.",
  stoppedText:
    "Trình duyệt đã ngắt phần dựng hình 3D của trang. Bạn vẫn xem được số đo, lỗi và khuôn phẳng bên dưới. Để dựng lại, hãy chọn lại file hoặc tải lại trang.",
  failureTitle: (name: string) => `Không dựng được lưới cho ${name}.`,
  failureText:
    "Hình học của phần in này trong file không dùng được để vẽ lưới (thiếu toạ độ điểm, hoặc không khớp loại sản phẩm). Phần đó hiện nguyên như trong file, chưa có lưới. Kiểm tra lại phần in này trong Blender rồi chọn lại file.",
  turnGroup: "Xoay model tới từng phần in",
  turn: {
    "BODY-front": "Xoay tới mặt trước ly",
    "BODY-back": "Xoay tới mặt sau ly (đường nối)",
    FRONT: "Xoay tới mặt trước",
    BACK: "Xoay tới mặt sau",
    LEFT: "Xoay tới hông trái",
    RIGHT: "Xoay tới hông phải",
  },
  sheetsTitle: "Khuôn phẳng của từng phần in",
  sheetLabel: (name: string) => `Khuôn phẳng của ${name}, có lưới đánh số`,
  sheetCaption: (name: string, size: string, bleed: string, safe: string) =>
    `${name}: phần in ${size}, tràn lề ${bleed}, lề an toàn ${safe}`,
  legendTitle: "Cách đọc lưới",
  legend: {
    lines: "Đường mỏng cách nhau 10 mm, đường đậm cách nhau 50 mm; mỗi ô 50 mm có một số.",
    cup: "Trên ly hình nón, chiều dọc thân luôn đúng 50 mm mỗi ô, còn chiều ngang chỉ đúng 50 mm ở giữa thân và giãn rộng dần về phía miệng ly.",
    margins:
      "Tràn lề: phần hình kéo ra ngoài đường cắt để không bị viền trắng. Lề an toàn: vùng cách mép vào trong, chữ và logo quan trọng nên nằm trong đó.",
  },
} as const;

/** Khi so file với khuôn tính từ chính nó (mất đối chiếu ở storefront; chép từ storefront `model-check-messages.ts`). */
export const MODEL3D_MISMATCH_MESSAGES = {
  hint: {
    cup: "Ly phải đứng thẳng quanh trục Y, tâm đáy đặt ở gốc toạ độ, đáy ở Y = 0.",
    bag: "Túi phải đặt chính giữa gốc toạ độ: mặt trước ở +½ độ sâu hông theo trục Z, mặt sau ở −½, hai hông ở ±½ chiều rộng theo trục X, đáy ở Y = 0. Mỗi mặt cũng phải nằm giữa theo chiều ngang, không lệch sang một bên.",
  },
  mismatch: (difference: string, hint: string) =>
    `Một số đo của phần in lệch quá 1 mm so với khuôn tính từ chính file (${difference}). ${hint}`,
  missingFaces: (names: readonly string[]) =>
    `Túi cần đủ bốn mặt in (print:FRONT, print:BACK, print:LEFT, print:RIGHT) nhưng file thiếu ${names.join(", ")}. Thêm các object này, đặt tên đúng, rồi xuất lại.`,
} as const;

/**
 * Mục "Logistics & quy cách thùng" ở panel biến thể (docs 01 §3 "Đơn vị quy đổi", "Quy cách thùng",
 * BR-03, BR-09; BE `UomConversionController`) và dialog khai báo / sửa thùng.
 */
export const CARTON_SPEC_UI_LABELS = {
  title: "Logistics & quy cách thùng",
  loading: "Đang tải quy cách thùng…",
  saved: "Đã lưu quy cách thùng",
  retired: "Đã ngưng dùng đơn vị",
  deleted: "Đã xoá đơn vị",
  otherUnits: "Đơn vị đóng gói khác",
  declareNew: "Khai báo thùng mới",
  declareNewHint:
    "Đổi số cái / thùng của thùng đã dùng: khai báo thùng mới (mã khác, là đơn vị giao mặc định) rồi ngưng thùng cũ.",
  retireUnit: (code: string) => `Ngưng dùng ${code}`,
  deleteUnit: (code: string) => `Xoá ${code}`,
  retireTitle: (code: string) => `Ngưng dùng đơn vị ${code}?`,
  deleteTitle: (code: string) => `Xoá đơn vị ${code}?`,
  retireDescription:
    "Đơn vị ngưng dùng không còn được chọn cho chứng từ mới; chứng từ cũ vẫn đọc được. Không làm đơn vị mua / giao mặc định nữa.",
  deleteDescription:
    "Chỉ xoá được đơn vị chưa từng dùng trên chứng từ và không đang bán. Không hoàn tác được.",
  retireConfirm: "Ngưng dùng",
  deleteConfirm: "Xoá",
  retry: "Thử lại",
  noPermission: "Bạn không có quyền xem quy cách thùng của SKU này.",
  baseUnit: "Đơn vị cơ sở",
  cartonUnit: "Đơn vị thùng",
  unitsPerCarton: "Số cái / thùng",
  cartonSize: "Kích thước thùng (D×R×C)",
  cartonVolume: "Thể tích thùng",
  cartonWeight: "Khối lượng thùng đầy",
  defaultShipping: "Đơn vị giao mặc định",
  notDeclared: "Chưa khai báo",
  yes: "Có",
  no: "Không",
  sizeValue: (l: string, w: string, h: string) => `${l} × ${w} × ${h} cm`,
  volumeValue: (m3: string) => `${m3} m³`,
  weightValue: (kg: string) => `${kg} kg`,
  unitsValue: (count: string, base: string) => `${count} ${base}`,
  none: "SKU chưa có quy cách thùng. Cần khai báo đơn vị thùng trước khi nhập kho theo thùng, in nhãn giao và xếp xe.",
  // BE #396 (docs 01 BR-03, 03 BR-13): số đo chỉ còn ở thùng — thiếu thì chưa nhập kho theo thùng được
  notMeasured:
    "Thùng chưa đủ kích thước và khối lượng thùng đầy — chưa nhập kho theo thùng và chưa in được nhãn giao cho thùng của SKU này.",
  ambiguous:
    "SKU có nhiều đơn vị đóng gói nhưng chưa chọn đơn vị giao mặc định, nên hệ thống chưa xác định được thùng. Sửa một đơn vị và đánh dấu là đơn vị giao mặc định.",
  declare: "Khai báo quy cách thùng",
  edit: "Sửa quy cách thùng",
  editUnit: (code: string) => `Sửa ${code}`,
  openInventoryItem: "Đơn vị tính, mã vạch, cho phép xoay: mở hồ sơ hàng tồn",
  dialog: {
    createTitle: "Khai báo quy cách thùng",
    editTitle: (code: string) => `Sửa quy cách thùng ${code}`,
    description:
      "Thùng là một đơn vị quy đổi của SKU: hệ số là số cái chuẩn trong một thùng, cố định cho SKU. Kích thước và khối lượng thùng đầy dùng cho nhãn giao, cất hàng và xếp xe.",
    submitCreate: "Khai báo",
    submitEdit: "Lưu",
    unitOfMeasure: "Mã đơn vị thùng *",
    unitOfMeasureHint: "Chữ in hoa, số hoặc _, tối đa 16 ký tự (vd CARTON).",
    unitsPerCarton: "Số cái chuẩn / thùng *",
    lengthCm: "Dài (cm)",
    widthCm: "Rộng (cm)",
    heightCm: "Cao (cm)",
    weightKg: "Khối lượng thùng đầy (kg)",
    measuresHint: "Bỏ trống nếu chưa đo; đủ bốn số mới nhập kho theo thùng và in được nhãn giao.",
    defaultShipping: "Là đơn vị giao mặc định (xếp xe ước tính theo thùng này)",
  },
  validation: {
    unitOfMeasure: "Mã đơn vị gồm 1–16 chữ in hoa, số hoặc _",
    unitsPerCarton: "Số cái / thùng là số nguyên từ 2 trở lên",
    size: "Kích thước là số dương, tối đa 2 chữ số thập phân (dùng dấu chấm)",
    weight: "Khối lượng là số dương, tối đa 3 chữ số thập phân (dùng dấu chấm)",
    defaultShipping: "Đơn vị đã ngừng dùng không làm đơn vị giao mặc định được",
  },
  error: {
    forbidden: "Bạn không có quyền với quy cách thùng của SKU này.",
    noItem: "SKU chưa có hồ sơ hàng tồn nên chưa có đơn vị tính.",
    notFound: "Không tìm thấy sản phẩm hoặc biến thể.",
    loadFailed: "Không tải được quy cách thùng. Vui lòng thử lại.",
    versionConflict:
      "Quy cách thùng vừa được người khác sửa. Dữ liệu đã được tải lại — hãy mở lại và nhập lại.",
    duplicate: "SKU đã có một đơn vị với mã này (kể cả đơn vị đã ngừng dùng).",
    inUse:
      "Không đổi được mã hoặc số cái / thùng: đơn vị này đang được bán hoặc đã dùng trên chứng từ.",
    unitGone: "Đơn vị này không còn. Dữ liệu đã được tải lại.",
    wouldNotFit:
      "Kích thước mới làm thùng đang cất không còn vừa vị trí hiện tại. Hãy chuyển thùng trước rồi sửa lại.",
    productLocked:
      "Sản phẩm đang chờ duyệt hoặc đã ngừng kinh doanh nên không sửa được quy cách thùng.",
    variantObsolete: "Biến thể đã ngừng dùng: đơn vị tính được giữ nguyên.",
    invalid: "Dữ liệu chưa hợp lệ.",
    unexpected: "Không lưu được quy cách thùng. Vui lòng thử lại.",
    retireInUse: "Biến thể đang bán theo đơn vị này — bỏ đơn vị bán đó trước rồi ngưng dùng.",
    deleteInUse:
      "Không xoá được: đơn vị đang được bán hoặc đã dùng trên chứng từ (hoặc là đơn vị cơ sở). Hãy ngưng dùng thay vì xoá.",
  },
} as const;

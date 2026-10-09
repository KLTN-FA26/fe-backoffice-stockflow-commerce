import Link from "next/link";
import { 
  FlaskConical, 
  Factory, 
  Share2, 
  Briefcase, 
  CheckCircle2, 
  ArrowRight,
  ExternalLink,
  Layers,
  ShieldAlert,
  Clock
} from "lucide-react";

export default function PreviewIndexPage() {
  const groups = [
    {
      id: "group-a",
      title: "Nhóm A: Yêu cầu mẫu & Nền tảng LSX",
      port: 3101,
      href: "/ui-preview/samples-production",
      description: "Quy trình tạo & theo dõi mẫu, khách hàng duyệt mẫu portal, danh sách lệnh sản xuất phân trang, chi tiết LSX kiểm tra file in prepress, hold/resume và hủy LSX.",
      tasks: [
        { key: "SCRUM-404", title: "Sales tạo mẫu & Khách duyệt mẫu portal (vòng duyệt, duyệt khoá thiết kế/yêu cầu sửa)", status: "Đã sẵn sàng" },
        { key: "SCRUM-406", title: "Danh sách Lệnh sản xuất (LSX) phân trang, lọc theo type (SAMPLE/ORDER), trạng thái, hạn giao", status: "Đã sẵn sàng" },
        { key: "SCRUM-408", title: "Chi tiết LSX — tải/xem trước file in prepress, kiểm tra đạt/hỏng, hold/resume có lý do", status: "Đã sẵn sàng" },
        { key: "SCRUM-414", title: "Hành động Hủy & Tạm dừng LSX — kiểm tra chính sách hủy (trước vs trong khi in), trả phôi", status: "Đã sẵn sàng" },
      ],
      color: "emerald",
      icon: FlaskConical,
    },
    {
      id: "group-b",
      title: "Nhóm B: Vận hành xưởng & Bàn giao",
      port: 3102,
      href: "/ui-preview/workshop",
      description: "Màn hình quét xuất phôi cho thủ kho, bảng Kanban xưởng in ấn theo trạng thái, QC sản xuất đối chiếu mẫu đã duyệt, danh sách hoàn thành bàn giao đóng gói, và dashboard xưởng phân quyền.",
      tasks: [
        { key: "SCRUM-410", title: "Quét xuất phôi sản xuất (Warehouse Staff scan phôi, chống xuất vượt BR-PRD-03)", status: "Đã sẵn sàng" },
        { key: "SCRUM-417", title: "Kanban xưởng in ấn (Bắt đầu in, ghi nhận sản lượng tốt/phế kèm lý do, in bù)", status: "Đã sẵn sàng" },
        { key: "SCRUM-419", title: "QC sản xuất — đối chiếu trực quan với mẫu đã duyệt (Side-by-side snapshot, pass/fail)", status: "Đã sẵn sàng" },
        { key: "SCRUM-412", title: "Danh sách hoàn thành & Xác nhận bàn giao sang khu vực Đóng gói (PACKING)", status: "Đã sẵn sàng" },
        { key: "SCRUM-416", title: "Dashboard xưởng & Menu theo quyền (LSX quá hạn, tỷ lệ phế, mẫu chờ duyệt, chuyển vai trò)", status: "Đã sẵn sàng" },
      ],
      color: "blue",
      icon: Factory,
    },
    {
      id: "group-c",
      title: "Nhóm C: Quản lý gia công ngoài (Subcontracting)",
      port: 3103,
      href: "/ui-preview/subcontract",
      description: "Tách lệnh sản xuất ủy thác gia công cho nhà cung cấp phụ trợ, theo dõi quan hệ cha - con, xuất phôi và in phiếu xuất kho gia công, theo dõi nhận lại & kiểm tra chất lượng.",
      tasks: [
        { key: "SCRUM-442", title: "Tách LSX (Split dialog số lượng cha-con, chọn đối tác, chế độ gia công, đơn giá, hạn giao)", status: "Đã sẵn sàng" },
        { key: "SCRUM-442-B", title: "Xuất phôi gia công, in Phiếu giao hàng / Dispatch Note chuẩn chỉnh", status: "Đã sẵn sàng" },
        { key: "SCRUM-442-C", title: "Theo dõi tiến độ nhận lại từ nhà gia công & cảnh báo hạn giao trên dashboard", status: "Đã sẵn sàng" },
      ],
      color: "purple",
      icon: Share2,
    },
    {
      id: "group-d",
      title: "Nhóm D: Khách hàng B2B & Báo giá bậc",
      port: 3104,
      href: "/ui-preview/b2b",
      description: "Tạo & gửi báo giá nhiều bậc số lượng (tier pricing / MOQ), portal khách hàng xem & chấp thuận báo giá, tạo hồ sơ doanh nghiệp B2B, gửi thư mời kích hoạt portal và trang kích hoạt.",
      tasks: [
        { key: "SCRUM-449", title: "Sales lập & gửi báo giá (bậc giá, điều khoản thanh toán, cảnh báo cần duyệt mẫu thiết kế mới)", status: "Đã sẵn sàng" },
        { key: "SCRUM-449-P", title: "Customer Portal xem báo giá, chấp thuận hoặc gửi yêu cầu điều chỉnh có phản hồi", status: "Đã sẵn sàng" },
        { key: "SCRUM-451", title: "Tạo & quản lý khách B2B (Mã số thuế, người liên hệ, hạn mức công nợ, gửi lại lời mời)", status: "Đã sẵn sàng" },
        { key: "SCRUM-451-A", title: "Portal kích hoạt tài khoản từ link mời (Màn hình kích hoạt, xử lý link hết hạn / đã dùng)", status: "Đã sẵn sàng" },
      ],
      color: "amber",
      icon: Briefcase,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Antigravity FE Preview Hub
              </span>
              <span className="text-xs text-[var(--ink-tertiary)]">Batch 1 · 12 Tasks</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--ink-primary)]">
              Trung tâm kiểm thử giao diện StockFlowCommerce
            </h1>
            <p className="mt-1 text-sm text-[var(--ink-secondary)] max-w-3xl">
              Tất cả các màn hình được xây dựng theo tiêu chuẩn Mode A (Odoo-inspired workflow), đầy đủ tính năng tương tác với kho dữ liệu mô phỏng in-memory, validation Zod, phản hồi trực quan, xem trực tiếp không cần đăng nhập.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <div className="rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-xs">
              <div className="font-medium text-[var(--ink-secondary)]">Lead Integration Port</div>
              <div className="text-base font-bold font-mono text-[var(--ink-primary)]">:3100</div>
            </div>
            <div className="rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-xs">
              <div className="font-medium text-[var(--ink-secondary)]">Trạng thái dữ liệu</div>
              <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">100% Mock Safe</div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of 4 groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <div
              key={group.id}
              className="flex flex-col justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xs hover:border-[var(--border-strong)] transition-all"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-default)]">
                      <Icon className="h-5 w-5 text-[var(--ink-primary)]" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-[var(--ink-primary)]">
                        {group.title}
                      </h2>
                      <span className="text-xs font-mono text-[var(--ink-tertiary)]">
                        Worker port :{group.port} · Scoped Module
                      </span>
                    </div>
                  </div>
                  <Link
                    href={group.href}
                    className="inline-flex items-center gap-1 rounded-md bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-[var(--ink-inverse)] hover:bg-[var(--brand-hover)] transition-colors"
                  >
                    <span>Vào xem</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-[var(--ink-secondary)]">
                  {group.description}
                </p>

                <div className="mt-4 border-t border-[var(--border-default)] pt-3">
                  <div className="text-xs font-medium text-[var(--ink-secondary)] mb-2 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-[var(--ink-tertiary)]" />
                    <span>Danh sách Jira Subtasks ({group.tasks.length}):</span>
                  </div>
                  <ul className="space-y-1.5">
                    {group.tasks.map((task) => (
                      <li key={task.key} className="flex items-start justify-between gap-2 text-xs">
                        <div className="flex items-start gap-1.5 min-w-0">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span className="font-mono font-medium text-[var(--ink-primary)] shrink-0">{task.key}:</span>
                          <span className="truncate text-[var(--ink-secondary)]">{task.title}</span>
                        </div>
                        <span className="shrink-0 text-[10px] rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-1.5 py-0.2 font-medium">
                          {task.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[var(--border-default)] flex items-center justify-between text-xs text-[var(--ink-tertiary)]">
                <span>Standalone Preview URL:</span>
                <Link
                  href={group.href}
                  className="font-mono text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                >
                  <span>{group.href}</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Guidelines & Operational Rules summary */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-5 text-xs text-[var(--ink-secondary)]">
        <h3 className="font-semibold text-sm text-[var(--ink-primary)] mb-2 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span>Nguyên tắc vận hành & An toàn dữ liệu:</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
          <div className="rounded bg-[var(--bg-surface)] p-3 border border-[var(--border-default)]">
            <div className="font-medium text-[var(--ink-primary)]">1. Không phụ thuộc Backend</div>
            <p className="mt-1 text-[11px] leading-relaxed">Toàn bộ dữ liệu được khởi tạo và lưu trữ trên bộ nhớ in-memory của trình duyệt. Khách hàng và nhân viên có thể tương tác đầy đủ mà không làm gián đoạn hệ thống BE.</p>
          </div>
          <div className="rounded bg-[var(--bg-surface)] p-3 border border-[var(--border-default)]">
            <div className="font-medium text-[var(--ink-primary)]">2. Bảo vệ quyền & Auth thật</div>
            <p className="mt-1 text-[11px] leading-relaxed">Các trang /ui-preview hoàn toàn độc lập bên ngoài /admin, không can thiệp hay vô hiệu hóa middleware xác thực thật của hệ thống production.</p>
          </div>
          <div className="rounded bg-[var(--bg-surface)] p-3 border border-[var(--border-default)]">
            <div className="font-medium text-[var(--ink-primary)]">3. Tiêu chuẩn thiết kế Odoo / Mode A</div>
            <p className="mt-1 text-[11px] leading-relaxed">Bảng dữ liệu phân trang, thanh trạng thái lifecycle, smart buttons, đối chiếu mẫu trực quan, form validation chuẩn tiếng Việt.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

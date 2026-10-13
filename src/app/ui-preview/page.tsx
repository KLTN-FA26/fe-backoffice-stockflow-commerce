import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  Factory,
  FlaskConical,
  Layers,
  Share2,
  ShieldAlert,
  Sliders,
} from "lucide-react";

import { StatusBadge } from "@/components/shared";

export default function PreviewIndexPage() {
  const groups = [
    {
      id: "group-a",
      title: "Nhóm A: Yêu cầu mẫu & Nền tảng LSX",
      port: 3101,
      href: "/ui-preview/samples-production",
      description:
        "Quy trình tạo & theo dõi mẫu, khách hàng duyệt mẫu portal, danh sách lệnh sản xuất phân trang, chi tiết LSX kiểm tra file in prepress, hold/resume và hủy LSX.",
      tasks: [
        {
          key: "SCRUM-404",
          title:
            "Sales tạo mẫu & Khách duyệt mẫu portal (vòng duyệt, duyệt khoá thiết kế/yêu cầu sửa)",
          status: "Đã sẵn sàng",
        },
        {
          key: "SCRUM-406",
          title:
            "Danh sách Lệnh sản xuất (LSX) phân trang, lọc theo type (SAMPLE/ORDER), trạng thái, hạn giao",
          status: "Đã sẵn sàng",
        },
        {
          key: "SCRUM-408",
          title:
            "Chi tiết LSX — tải/xem trước file in prepress, kiểm tra đạt/hỏng, hold/resume có lý do",
          status: "Đã sẵn sàng",
        },
        {
          key: "SCRUM-414",
          title:
            "Hành động Hủy & Tạm dừng LSX — kiểm tra chính sách hủy (trước vs trong khi in), trả phôi",
          status: "Đã sẵn sàng",
        },
      ],
      color: "emerald",
      icon: FlaskConical,
    },
    {
      id: "group-b",
      title: "Nhóm B: Vận hành xưởng & Bàn giao",
      port: 3102,
      href: "/ui-preview/workshop",
      description:
        "Màn hình quét xuất phôi cho thủ kho, bảng Kanban xưởng in ấn theo trạng thái, QC sản xuất đối chiếu mẫu đã duyệt, danh sách hoàn thành bàn giao đóng gói, và dashboard xưởng phân quyền.",
      tasks: [
        {
          key: "SCRUM-410",
          title: "Quét xuất phôi sản xuất (Warehouse Staff scan phôi, chống xuất vượt BR-PRD-03)",
          status: "Đã sẵn sàng",
        },
        {
          key: "SCRUM-417",
          title: "Kanban xưởng in ấn (Bắt đầu in, ghi nhận sản lượng tốt/phế kèm lý do, in bù)",
          status: "Đã sẵn sàng",
        },
        {
          key: "SCRUM-419",
          title:
            "QC sản xuất — đối chiếu trực quan với mẫu đã duyệt (Side-by-side snapshot, pass/fail)",
          status: "Đã sẵn sàng",
        },
        {
          key: "SCRUM-412",
          title: "Danh sách hoàn thành & Xác nhận bàn giao sang khu vực Đóng gói (PACKING)",
          status: "Đã sẵn sàng",
        },
        {
          key: "SCRUM-416",
          title:
            "Dashboard xưởng & Menu theo quyền (LSX quá hạn, tỷ lệ phế, mẫu chờ duyệt, chuyển vai trò)",
          status: "Đã sẵn sàng",
        },
      ],
      color: "blue",
      icon: Factory,
    },
    {
      id: "group-c",
      title: "Nhóm C: Quản lý gia công ngoài (Subcontracting)",
      port: 3103,
      href: "/ui-preview/subcontract",
      description:
        "Tách lệnh sản xuất ủy thác gia công cho nhà cung cấp phụ trợ, theo dõi quan hệ cha - con, xuất phôi và in phiếu xuất kho gia công, theo dõi nhận lại & kiểm tra chất lượng.",
      tasks: [
        {
          key: "SCRUM-442",
          title:
            "Tách LSX (Split dialog số lượng cha-con, chọn đối tác, chế độ gia công, đơn giá, hạn giao)",
          status: "Đã sẵn sàng",
        },
        {
          key: "SCRUM-442-B",
          title: "Xuất phôi gia công, in Phiếu giao hàng / Dispatch Note chuẩn chỉnh",
          status: "Đã sẵn sàng",
        },
        {
          key: "SCRUM-442-C",
          title: "Theo dõi tiến độ nhận lại từ nhà gia công & cảnh báo hạn giao trên dashboard",
          status: "Đã sẵn sàng",
        },
      ],
      color: "purple",
      icon: Share2,
    },
    {
      id: "group-d",
      title: "Nhóm D: Khách hàng B2B & Báo giá bậc",
      port: 3104,
      href: "/ui-preview/b2b",
      description:
        "Tạo & gửi báo giá nhiều bậc số lượng (tier pricing / MOQ), portal khách hàng xem & chấp thuận báo giá, tạo hồ sơ doanh nghiệp B2B, gửi thư mời kích hoạt portal và trang kích hoạt.",
      tasks: [
        {
          key: "SCRUM-449",
          title:
            "Sales lập & gửi báo giá (bậc giá, điều khoản thanh toán, cảnh báo cần duyệt mẫu thiết kế mới)",
          status: "Đã sẵn sàng",
        },
        {
          key: "SCRUM-449-P",
          title: "Customer Portal xem báo giá, chấp thuận hoặc gửi yêu cầu điều chỉnh có phản hồi",
          status: "Đã sẵn sàng",
        },
        {
          key: "SCRUM-451",
          title:
            "Tạo & quản lý khách B2B (Mã số thuế, người liên hệ, hạn mức công nợ, gửi lại lời mời)",
          status: "Đã sẵn sàng",
        },
        {
          key: "SCRUM-451-A",
          title:
            "Portal kích hoạt tài khoản từ link mời (Màn hình kích hoạt, xử lý link hết hạn / đã dùng)",
          status: "Đã sẵn sàng",
        },
      ],
      color: "amber",
      icon: Briefcase,
    },
    {
      id: "group-batch2",
      title: "Gói Mở Rộng UI Batch 2 (Toàn diện)",
      port: 3100,
      href: "/ui-preview/batch2",
      description:
        "Đầy đủ 7 tính năng Batch 2: Dòng thời gian đơn hàng bán, Giữ tồn kho khi thanh toán 15 phút, Cổng gửi và phê duyệt RMA đổi trả, Bộ tính giá tùy biến in ấn, Thiết kế khuôn bế 2D, và Widget chat tư vấn nổi.",
      tasks: [
        {
          key: "SCRUM-248",
          title:
            "Dòng thời gian đơn hàng bán (Sales order timeline với mốc thời gian, nhân sự, vai trò)",
          status: "Đã sẵn sàng",
        },
        {
          key: "SCRUM-212",
          title: "Giữ tồn kho khi checkout (15 phút TTL countdown, gia hạn/hủy, chống overselling)",
          status: "Đã sẵn sàng",
        },
        {
          key: "SCRUM-257",
          title:
            "Cổng gửi RMA đổi trả khách hàng (Chọn dòng đơn, lý do in/vận chuyển, tải ảnh lỗi)",
          status: "Đã sẵn sàng",
        },
        {
          key: "SCRUM-258",
          title:
            "Hàng đợi duyệt RMA Backoffice (Thẩm định ảnh, phê duyệt cấp mã RMA Auth, in nhãn thu hồi)",
          status: "Đã sẵn sàng",
        },
        {
          key: "SCRUM-304",
          title:
            "Tính giá tùy biến trực tiếp (Phí khuôn Flexo/Lụa/Offset, số màu, cán màng/ép kim, chiết khấu)",
          status: "Đã sẵn sàng",
        },
        {
          key: "SCRUM-299/300",
          title: "Khuôn bế 2D bao bì vs Bố cục phòng ốc (Mô tả Jira cũ) — Bản vẽ demo",
          status: "Chờ chốt nghiệp vụ",
        },
        {
          key: "SCRUM-320",
          title:
            "Widget chat Storefront nổi (Tư vấn trực tuyến, câu hỏi gợi ý nhanh, giải đáp tức thì)",
          status: "Đã sẵn sàng",
        },
      ],
      color: "indigo",
      icon: Layers,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />
                Antigravity FE Preview Hub
              </span>
              <span className="text-xs text-[var(--ink-tertiary)]">
                Batch 1 (12 Task) & Batch 2 (8 Task)
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--ink-primary)]">
              Trung tâm kiểm thử giao diện StockFlowCommerce
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--ink-secondary)]">
              Tất cả các màn hình được xây dựng theo tiêu chuẩn Mode A (Odoo-inspired workflow), đầy
              đủ tính năng tương tác với kho dữ liệu mô phỏng in-memory, validation Zod, phản hồi
              trực quan, xem trực tiếp không cần đăng nhập.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <div className="rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-xs">
              <div className="font-medium text-[var(--ink-secondary)]">Môi trường xem trước</div>
              <div className="font-mono text-base font-bold text-[var(--brand)]">Local Preview</div>
            </div>
            <div className="rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-xs">
              <div className="font-medium text-[var(--ink-secondary)]">Trạng thái dữ liệu</div>
              <div className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                100% Mock Safe
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of groups */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <div
              key={group.id}
              className="flex flex-col justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xs transition-all hover:border-[var(--border-strong)]"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)]">
                      <Icon className="h-5 w-5 text-[var(--ink-primary)]" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-[var(--ink-primary)]">
                        {group.title}
                      </h2>
                      <span className="font-mono text-xs text-[var(--ink-tertiary)]">
                        Phân hệ độc lập · Mock Repo In-Memory
                      </span>
                    </div>
                  </div>
                  <Link
                    href={group.href}
                    className="inline-flex items-center gap-1 rounded-md bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-[var(--ink-inverse)] transition-colors hover:bg-[var(--brand-hover)]"
                  >
                    <span>Vào xem</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-[var(--ink-secondary)]">
                  {group.description}
                </p>

                <div className="mt-4 border-t border-[var(--border-default)] pt-3">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--ink-secondary)]">
                    <Layers className="h-3.5 w-3.5 text-[var(--ink-tertiary)]" />
                    <span>Danh sách Jira Subtasks ({group.tasks.length}):</span>
                  </div>
                  <ul className="space-y-1.5">
                    {group.tasks.map((task) => {
                      const isPending = task.status.includes("Chờ");
                      return (
                        <li
                          key={task.key}
                          className="flex items-start justify-between gap-2 text-xs"
                        >
                          <div className="flex min-w-0 items-start gap-1.5">
                            {isPending ? (
                              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                            ) : (
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            )}
                            <span className="shrink-0 font-mono font-medium text-[var(--ink-primary)]">
                              {task.key}:
                            </span>
                            <span className="truncate text-[var(--ink-secondary)]">
                              {task.title}
                            </span>
                          </div>
                          <span
                            className={`py-0.2 shrink-0 rounded px-1.5 text-[10px] font-medium ${
                              isPending
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            }`}
                          >
                            {task.status}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-[var(--border-default)] pt-3 text-xs text-[var(--ink-tertiary)]">
                <span>Standalone Preview URL:</span>
                <Link
                  href={group.href}
                  className="flex items-center gap-1 font-mono text-xs text-sky-600 hover:underline dark:text-sky-400"
                >
                  <span>{group.href}</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Design System & Component Consistency Gallery (Mode A Standards) */}
      <div className="space-y-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xs">
        <div className="border-b border-[var(--border-default)] pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-[var(--brand)] dark:border-sky-800 dark:bg-sky-950">
              <Sliders className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[var(--ink-primary)]">
                Thư Viện Chuẩn Hóa Giao Diện Mode A & Design Tokens
              </h2>
              <p className="text-xs text-[var(--ink-secondary)]">
                Bộ tiêu chuẩn giao diện áp dụng nhất quán trên toàn bộ 20 màn hình: thứ bậc màu sắc
                ngữ nghĩa, thẻ trạng thái chuẩn, font số tabular và biểu ngữ thông báo.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 text-xs md:grid-cols-2">
          {/* 1. Status Badges */}
          <div className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
            <div className="flex items-center justify-between font-semibold text-[var(--ink-primary)]">
              <span>1. Thẻ trạng thái chuẩn (Canonical Status Badges)</span>
              <span className="font-mono text-[10px] text-[var(--ink-tertiary)]">
                status-map.ts
              </span>
            </div>
            <p className="text-[11px] text-[var(--ink-secondary)]">
              Mọi quy trình từ tạo mẫu, lệnh sản xuất, gia công đến RMA đều dùng chung bộ thẻ ngữ
              nghĩa không dùng màu trần tự phát:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <StatusBadge status="DRAFT" />
              <StatusBadge status="PENDING" />
              <StatusBadge status="APPROVED" />
              <StatusBadge status="READY" />
              <StatusBadge status="IN_PROGRESS" />
              <StatusBadge status="PRINTING" />
              <StatusBadge status="COMPLETED" />
              <StatusBadge status="HOLD" />
              <StatusBadge status="CANCELLED" />
            </div>
          </div>

          {/* 2. Action Hierarchy */}
          <div className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
            <div className="flex items-center justify-between font-semibold text-[var(--ink-primary)]">
              <span>2. Thứ bậc nút bấm Mode A (Action Button Hierarchy)</span>
              <span className="font-mono text-[10px] text-[var(--ink-tertiary)]">
                focus-visible:ring-2
              </span>
            </div>
            <p className="text-[11px] text-[var(--ink-secondary)]">
              Nút thao tác chính (Primary) dùng tone Ink/Sky; Thao tác duyệt/hoàn thành dùng
              Emerald; Từ chối/hủy dùng Rose:
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                className="rounded-md bg-[var(--brand)] px-3 py-1.5 font-semibold text-[var(--ink-inverse)] shadow-xs transition-colors hover:bg-[var(--brand-hover)] focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-hidden"
              >
                Chính (Primary)
              </button>
              <button
                type="button"
                className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 font-medium text-[var(--ink-secondary)] shadow-xs transition-colors hover:bg-[var(--bg-muted)]"
              >
                Phụ (Secondary)
              </button>
              <button
                type="button"
                className="rounded-md bg-emerald-600 px-3 py-1.5 font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden"
              >
                Phê duyệt (Success)
              </button>
              <button
                type="button"
                className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 font-semibold text-rose-700 shadow-xs transition-colors hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
              >
                Từ chối (Danger)
              </button>
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-md border border-[var(--border-default)] bg-[var(--bg-muted)] px-3 py-1.5 font-medium text-[var(--ink-tertiary)] opacity-60"
              >
                Khóa (Disabled)
              </button>
            </div>
          </div>

          {/* 3. Tabular Numbers */}
          <div className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
            <div className="flex items-center justify-between font-semibold text-[var(--ink-primary)]">
              <span>3. Định dạng số tài chính & Kỹ thuật (Tabular Numbers)</span>
              <span className="font-mono text-[10px] text-[var(--ink-tertiary)]">
                tabular-nums font-mono
              </span>
            </div>
            <p className="text-[11px] text-[var(--ink-secondary)]">
              Đảm bảo các chữ số căn thẳng hàng dọc tuyệt đối trong bảng báo giá bậc, định mức phôi
              và báo cáo doanh thu:
            </p>
            <div className="space-y-1 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] p-2.5 font-mono text-[11px]">
              <div className="flex justify-between border-b border-[var(--border-default)] pb-1 font-sans font-semibold text-[var(--ink-secondary)]">
                <span>Hạng mục chi phí</span>
                <span>Số tiền (Căn phải tabular)</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-[var(--ink-secondary)]">Phôi ly giấy Kraft:</span>
                <span className="font-bold text-[var(--ink-primary)] tabular-nums">
                  12,500,000 đ
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-[var(--ink-secondary)]">
                  Phí bản in Flexo 2 màu:
                </span>
                <span className="font-bold text-[var(--ink-primary)] tabular-nums">
                  1,100,000 đ
                </span>
              </div>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span className="font-sans">Chiết khấu số lượng (8%):</span>
                <span className="font-bold tabular-nums">- 1,088,000 đ</span>
              </div>
              <div className="flex justify-between border-t border-[var(--border-default)] pt-1 text-xs font-bold text-[var(--brand)]">
                <span className="font-sans">Tổng quyết toán:</span>
                <span className="tabular-nums">12,512,000 đ</span>
              </div>
            </div>
          </div>

          {/* 4. Feedback Banners */}
          <div className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
            <div className="flex items-center justify-between font-semibold text-[var(--ink-primary)]">
              <span>4. Biểu ngữ thông báo & Cảnh báo ngữ nghĩa</span>
              <span className="font-mono text-[10px] text-[var(--ink-tertiary)]">
                Inline Validation
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-2 text-[11px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span>Thành công: Đã xác nhận bàn giao 10,000 sản phẩm sang khu vực Đóng gói.</span>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>
                  Giả định Demo: Thời hạn giữ tồn kho 15 phút (900s) phục vụ kiểm thử luồng Odoo.
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 p-2 text-[11px] text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                <span>
                  Lỗi BR-PRD-03: Không thể xuất quá số lượng phôi kế hoạch còn lại của lệnh sản
                  xuất.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Guidelines & Operational Rules summary */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-5 text-xs text-[var(--ink-secondary)]">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--ink-primary)]">
          <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span>Nguyên tắc vận hành & An toàn dữ liệu:</span>
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
            <div className="font-medium text-[var(--ink-primary)]">1. Không phụ thuộc Backend</div>
            <p className="mt-1 text-[11px] leading-relaxed">
              Toàn bộ dữ liệu được khởi tạo và lưu trữ trên bộ nhớ in-memory của trình duyệt. Khách
              hàng và nhân viên có thể tương tác đầy đủ mà không làm gián đoạn hệ thống BE.
            </p>
          </div>
          <div className="rounded border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
            <div className="font-medium text-[var(--ink-primary)]">2. Bảo vệ quyền & Auth thật</div>
            <p className="mt-1 text-[11px] leading-relaxed">
              Các trang /ui-preview hoàn toàn độc lập bên ngoài /admin, không can thiệp hay vô hiệu
              hóa middleware xác thực thật của hệ thống production.
            </p>
          </div>
          <div className="rounded border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
            <div className="font-medium text-[var(--ink-primary)]">
              3. Tiêu chuẩn thiết kế Odoo / Mode A
            </div>
            <p className="mt-1 text-[11px] leading-relaxed">
              Bảng dữ liệu phân trang, thanh trạng thái lifecycle, smart buttons, đối chiếu mẫu trực
              quan, form validation chuẩn tiếng Việt.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

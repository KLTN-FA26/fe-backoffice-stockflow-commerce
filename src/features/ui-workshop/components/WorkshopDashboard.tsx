"use client";

import { useState } from "react";
import {
  Layers,
  AlertTriangle,
  TrendingDown,
  Clock,
  Users,
  UserCheck,
  Lock,
  Unlock,
} from "lucide-react";
import { WorkshopRole } from "../types";
import { workshopRepo } from "../mock-repo";

interface Props {
  onSelectTab: (tab: "scan" | "kanban" | "qc" | "handoff") => void;
}

export function WorkshopDashboard({ onSelectTab }: Props) {
  const [currentRole, setCurrentRole] = useState<WorkshopRole>("PRODUCTION_STAFF");
  const metrics = workshopRepo.getMetrics();

  const rolePermissions: Record<WorkshopRole, { title: string; desc: string; allowed: string[] }> =
    {
      PRODUCTION_STAFF: {
        title: "Nhân viên Vận hành Xưởng (Production Staff)",
        desc: "Thực hiện kiểm tra prepress, vận hành máy in, ghi nhận sản lượng tốt và phế phẩm.",
        allowed: ["prepress-check", "kanban-print", "record-print-output"],
      },
      QC_STAFF: {
        title: "Nhân viên Kiểm định Chất lượng (QC Staff)",
        desc: "Đối chiếu trực quan với mẫu đã duyệt, ghi nhận Pass/Fail, kích hoạt in bù.",
        allowed: ["qc-inspection", "qc-scrap-record", "reprint-trigger"],
      },
      WAREHOUSE_STAFF: {
        title: "Thủ kho / Nhân viên Kho (Warehouse Staff)",
        desc: "Quét xuất phôi sản xuất (chống xuất vượt), xác nhận bàn giao thành phẩm sang đóng gói.",
        allowed: ["blank-issue-scan", "packing-handoff"],
      },
      WAREHOUSE_MANAGER: {
        title: "Quản đốc Xưởng / Quản lý Kho (Warehouse Manager)",
        desc: "Toàn quyền giám sát, phê duyệt ngoại lệ, tạm dừng / tiếp tục lệnh (Hold/Resume), hủy LSX.",
        allowed: ["all-access", "hold-resume-override", "cancellation-override"],
      },
    };

  const activePerm = rolePermissions[currentRole];

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--ink-secondary)]">
            <span>LSX Đang sản xuất</span>
            <Layers className="h-4 w-4 text-[var(--accent)]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-[var(--ink-primary)]">
            {metrics.totalActiveOrders}
          </div>
          <div className="mt-1 flex gap-2 text-[11px] text-[var(--ink-tertiary)]">
            <span>Ready: {metrics.readyOrdersCount}</span>
            <span>·</span>
            <span>Printing: {metrics.printingCount}</span>
          </div>
        </div>

        <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-4 shadow-xs dark:bg-rose-950/20">
          <div className="flex items-center justify-between text-xs text-rose-800 dark:text-rose-300">
            <span>LSX Quá hạn (Overdue)</span>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-rose-700 dark:text-rose-400">
            {metrics.overdueOrdersCount}
          </div>
          <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
            Cần ưu tiên sắp ca in ngay
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 shadow-xs dark:bg-amber-950/20">
          <div className="flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
            <span>Tỷ lệ Phế phẩm (Scrap Rate)</span>
            <TrendingDown className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-amber-800 dark:text-amber-300">
            {metrics.scrapRatePercent}%
          </div>
          <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
            Ngưỡng cho phép: ≤ 3.5%
          </div>
        </div>

        <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4 shadow-xs dark:bg-purple-950/20">
          <div className="flex items-center justify-between text-xs text-purple-800 dark:text-purple-300">
            <span>Mẫu chờ khách duyệt</span>
            <Clock className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-purple-800 dark:text-purple-300">
            {metrics.pendingSampleApprovalCount}
          </div>
          <div className="mt-1 text-[11px] text-purple-700 dark:text-purple-400">
            Đang ở vòng duyệt khách
          </div>
        </div>
      </div>

      {/* Role Switcher & Permission-gated Menu Simulator (SCRUM-416) */}
      <div className="space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--ink-primary)]">
              <Users className="h-4 w-4 text-[var(--accent)]" />
              <span>Chuyển đổi Vai trò Phân quyền Xưởng (Role-based Permission Preview)</span>
            </h3>
            <p className="text-xs text-[var(--ink-secondary)]">
              Mô phỏng giao diện và các menu chức năng mở theo từng vai trò nhân viên tại xưởng
              (SCRUM-416 / `@PermissionResource`).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--ink-tertiary)]">Chọn vai trò:</span>
            <select
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value as WorkshopRole)}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-primary)]"
            >
              <option value="PRODUCTION_STAFF">Production Staff (Thợ in)</option>
              <option value="QC_STAFF">QC Staff (Kiểm định)</option>
              <option value="WAREHOUSE_STAFF">Warehouse Staff (Thủ kho)</option>
              <option value="WAREHOUSE_MANAGER">Warehouse Manager (Quản đốc)</option>
            </select>
          </div>
        </div>

        {/* Current Role Banner */}
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--ink-primary)]">
            <UserCheck className="h-4 w-4 text-[var(--accent)]" />
            <span>{activePerm.title}</span>
          </div>
          <p className="mt-1 text-xs text-[var(--ink-secondary)]">{activePerm.desc}</p>
        </div>

        {/* Permission Actions Grid */}
        <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Blank Scanning */}
          <div
            className={`flex flex-col justify-between rounded-md border p-4 ${
              activePerm.allowed.includes("blank-issue-scan") ||
              activePerm.allowed.includes("all-access")
                ? "border-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/20"
                : "border-[var(--border-default)] bg-[var(--bg-muted)] opacity-60"
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Quét xuất phôi (SCRUM-410)</span>
                {activePerm.allowed.includes("blank-issue-scan") ||
                activePerm.allowed.includes("all-access") ? (
                  <Unlock className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Lock className="h-4 w-4 text-[var(--ink-tertiary)]" />
                )}
              </div>
              <p className="mt-2 text-[11px] text-[var(--ink-secondary)]">
                Thủ kho scan phôi, chống xuất vượt.
              </p>
            </div>
            <button
              onClick={() => onSelectTab("scan")}
              disabled={
                !(
                  activePerm.allowed.includes("blank-issue-scan") ||
                  activePerm.allowed.includes("all-access")
                )
              }
              className="mt-4 rounded bg-[var(--brand)] px-3 py-1.5 text-xs text-[var(--ink-inverse)] hover:bg-[var(--brand-hover)] disabled:opacity-50"
            >
              Vào quét phôi
            </button>
          </div>

          {/* Card 2: Kanban Print */}
          <div
            className={`flex flex-col justify-between rounded-md border p-4 ${
              activePerm.allowed.includes("kanban-print") ||
              activePerm.allowed.includes("all-access")
                ? "border-indigo-300 bg-indigo-50/30 dark:bg-indigo-950/20"
                : "border-[var(--border-default)] bg-[var(--bg-muted)] opacity-60"
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Bảng Kanban xưởng (SCRUM-417)</span>
                {activePerm.allowed.includes("kanban-print") ||
                activePerm.allowed.includes("all-access") ? (
                  <Unlock className="h-4 w-4 text-indigo-600" />
                ) : (
                  <Lock className="h-4 w-4 text-[var(--ink-tertiary)]" />
                )}
              </div>
              <p className="mt-2 text-[11px] text-[var(--ink-secondary)]">
                Lên máy in, ghi nhận sản lượng & phế phẩm.
              </p>
            </div>
            <button
              onClick={() => onSelectTab("kanban")}
              disabled={
                !(
                  activePerm.allowed.includes("kanban-print") ||
                  activePerm.allowed.includes("all-access")
                )
              }
              className="mt-4 rounded bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Mở Kanban xưởng
            </button>
          </div>

          {/* Card 3: QC Inspection */}
          <div
            className={`flex flex-col justify-between rounded-md border p-4 ${
              activePerm.allowed.includes("qc-inspection") ||
              activePerm.allowed.includes("all-access")
                ? "border-purple-300 bg-purple-50/30 dark:bg-purple-950/20"
                : "border-[var(--border-default)] bg-[var(--bg-muted)] opacity-60"
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Trạm kiểm định QC (SCRUM-419)</span>
                {activePerm.allowed.includes("qc-inspection") ||
                activePerm.allowed.includes("all-access") ? (
                  <Unlock className="h-4 w-4 text-purple-600" />
                ) : (
                  <Lock className="h-4 w-4 text-[var(--ink-tertiary)]" />
                )}
              </div>
              <p className="mt-2 text-[11px] text-[var(--ink-secondary)]">
                Đối chiếu trực quan mẫu duyệt, ghi nhận Pass/Fail.
              </p>
            </div>
            <button
              onClick={() => onSelectTab("qc")}
              disabled={
                !(
                  activePerm.allowed.includes("qc-inspection") ||
                  activePerm.allowed.includes("all-access")
                )
              }
              className="mt-4 rounded bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-700 disabled:opacity-50"
            >
              Vào trạm QC
            </button>
          </div>

          {/* Card 4: Packing Handoff */}
          <div
            className={`flex flex-col justify-between rounded-md border p-4 ${
              activePerm.allowed.includes("packing-handoff") ||
              activePerm.allowed.includes("all-access")
                ? "border-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/20"
                : "border-[var(--border-default)] bg-[var(--bg-muted)] opacity-60"
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Bàn giao đóng gói (SCRUM-412)</span>
                {activePerm.allowed.includes("packing-handoff") ||
                activePerm.allowed.includes("all-access") ? (
                  <Unlock className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Lock className="h-4 w-4 text-[var(--ink-tertiary)]" />
                )}
              </div>
              <p className="mt-2 text-[11px] text-[var(--ink-secondary)]">
                Xác nhận chuyển thành phẩm đạt chuẩn sang PACKING.
              </p>
            </div>
            <button
              onClick={() => onSelectTab("handoff")}
              disabled={
                !(
                  activePerm.allowed.includes("packing-handoff") ||
                  activePerm.allowed.includes("all-access")
                )
              }
              className="mt-4 rounded bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              DS Bàn giao
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

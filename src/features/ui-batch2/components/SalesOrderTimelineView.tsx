"use client";

import { useState } from "react";
import { Clock, CheckCircle2, CircleDot, Plus, User, AlertCircle } from "lucide-react";
import { StatusBadge } from "@/components/shared";
import { batch2Repo } from "../mock-repo";
import { SalesOrderStatus } from "../types";

export function SalesOrderTimelineView() {
  const orders = batch2Repo.getSalesOrders();
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || "");
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [newStatus, setNewStatus] = useState<SalesOrderStatus>("PICKING");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newActor, setNewActor] = useState("Võ Hoàng Minh (Điều phối kho)");
  const [eventError, setEventError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const selectedOrder = batch2Repo.getSalesOrderById(selectedOrderId) || orders[0];

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setEventError("Vui lòng nhập tiêu đề sự kiện mốc thời gian trước khi lưu!");
      return;
    }
    setEventError(null);
    batch2Repo.addTimelineEvent(
      selectedOrder.id,
      newStatus,
      newTitle,
      newDesc || "Ghi nhận tiến độ cập nhật thực tế từ hệ thống.",
      newActor,
    );
    setShowAddEventModal(false);
    setNewTitle("");
    setNewDesc("");
    setTick((t) => t + 1);
  };

  const getActorBadge = (role: string) => {
    switch (role) {
      case "SYSTEM":
        return (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Hệ thống
          </span>
        );
      case "CUSTOMER":
        return (
          <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            Khách hàng
          </span>
        );
      case "SALES":
        return (
          <span className="rounded bg-purple-100 px-1.5 py-0.5 font-mono text-[10px] text-purple-800 dark:bg-purple-950 dark:text-purple-300">
            Kinh doanh / Kế toán
          </span>
        );
      case "WORKSHOP":
        return (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Xưởng sản xuất
          </span>
        );
      case "WAREHOUSE":
        return (
          <span className="rounded bg-teal-100 px-1.5 py-0.5 font-mono text-[10px] text-teal-800 dark:bg-teal-950 dark:text-teal-300">
            Kho vận
          </span>
        );
      case "LOGISTICS":
        return (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Vận chuyển
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink-primary)]">
            <Clock className="h-5 w-5 text-indigo-600" />
            <span>Dòng Thời Gian Đơn Hàng Bán (Sales Order Lifecycle Timeline — SCRUM-248)</span>
          </h2>
          <p className="text-xs text-[var(--ink-secondary)]">
            Theo dõi hành trình đơn hàng từ Đặt cọc → Phát hành LSX → In ấn xưởng → Nhặt hàng → Đóng
            gói → Giao hàng.
          </p>
        </div>

        <button
          onClick={() => setShowAddEventModal(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--brand)] px-3 py-2 text-xs font-medium text-[var(--ink-inverse)] shadow-xs transition-colors hover:bg-[var(--brand-hover)]"
        >
          <Plus className="h-4 w-4" />
          <span>Ghi nhận sự kiện mới</span>
        </button>
      </div>

      {/* Main Grid: Selector & Order Info */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Order Selector & Summary */}
        <div className="space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs">
          <h3 className="text-sm font-semibold text-[var(--ink-primary)]">
            Chọn Đơn hàng cần theo dõi
          </h3>

          <div className="space-y-2">
            {orders.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelectedOrderId(o.id)}
                className={`w-full rounded-lg border p-3 text-left text-xs transition-all ${
                  selectedOrder.id === o.id
                    ? "border-[var(--brand)] bg-[var(--bg-muted)] shadow-xs"
                    : "border-[var(--border-default)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-muted)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[var(--ink-primary)]">
                    {o.orderCode}
                  </span>
                  <StatusBadge status={o.currentStatus} />
                </div>
                <div className="mt-1 truncate font-medium text-[var(--ink-primary)]">
                  {o.customerName}
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--ink-tertiary)]">
                  <span>{o.totalAmount.toLocaleString()} đ</span>
                  <span className="whitespace-nowrap">{o.createdAt}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Current Order Summary Card */}
          <div className="space-y-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 text-xs">
            <div className="font-semibold text-[var(--ink-primary)]">
              Thông tin đơn hàng hiện tại:
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-secondary)]">Khách hàng:</span>
              <span className="font-medium">{selectedOrder.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-secondary)]">Email:</span>
              <span className="font-mono text-[11px]">{selectedOrder.customerEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-secondary)]">Giá trị đơn:</span>
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                {selectedOrder.totalAmount.toLocaleString()} đ
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-secondary)]">Trạng thái:</span>
              <StatusBadge status={selectedOrder.currentStatus} />
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-secondary)]">Đơn vị vận chuyển:</span>
              <span className="font-medium text-sky-700 dark:text-sky-300">
                {selectedOrder.carrierName || "Chưa gán"}
              </span>
            </div>
            <div className="border-t border-[var(--border-default)] pt-1 text-[11px] text-[var(--ink-tertiary)]">
              📍 Giao đến: {selectedOrder.deliveryAddress}
            </div>
          </div>
        </div>

        {/* Right: Vertical Timeline Display */}
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xs lg:col-span-2">
          <div className="mb-6 flex items-center justify-between border-b border-[var(--border-default)] pb-4">
            <div>
              <h3 className="font-mono text-base font-bold text-[var(--ink-primary)]">
                {selectedOrder.orderCode} — Nhật ký hành trình
              </h3>
              <p className="mt-0.5 text-xs text-[var(--ink-secondary)]">
                Ghi nhận theo thời gian thực (Real-time chronological events)
              </p>
            </div>
            <span className="font-mono text-xs text-[var(--ink-tertiary)]">
              {selectedOrder.timeline.length} mốc sự kiện
            </span>
          </div>

          {/* Timeline Milestones */}
          <div className="relative space-y-8 pl-6 before:absolute before:top-3 before:bottom-3 before:left-2.5 before:w-0.5 before:bg-[var(--border-default)]">
            {selectedOrder.timeline.map((event, index) => {
              const isLast = index === selectedOrder.timeline.length - 1;
              return (
                <div key={event.id} className="group relative">
                  {/* Milestone Node */}
                  <div
                    className={`absolute top-1.5 -left-[27px] flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                      isLast
                        ? "border-emerald-600 bg-emerald-500 text-white ring-4 ring-emerald-100 dark:ring-emerald-950"
                        : "border-[var(--brand)] bg-[var(--bg-surface)] text-[var(--brand)]"
                    }`}
                  >
                    {isLast ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <CircleDot className="h-3 w-3" />
                    )}
                  </div>

                  {/* Milestone Card */}
                  <div className="space-y-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4 transition-colors hover:border-[var(--brand)]">
                    <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[var(--ink-primary)]">
                          {event.title}
                        </span>
                        <StatusBadge status={event.status} size="sm" />
                      </div>
                      <span className="font-mono text-[11px] whitespace-nowrap text-[var(--ink-tertiary)]">
                        {event.timestamp}
                      </span>
                    </div>

                    <p className="text-xs leading-relaxed text-[var(--ink-secondary)]">
                      {event.description}
                    </p>

                    <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-2 text-[11px]">
                      <div className="flex items-center gap-1.5 text-[var(--ink-secondary)]">
                        <User className="h-3 w-3 text-[var(--ink-tertiary)]" />
                        <span>
                          Người thực hiện:{" "}
                          <strong className="text-[var(--ink-primary)]">{event.actor}</strong>
                        </span>
                      </div>
                      <div>{getActorBadge(event.actorRole)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Milestone Modal */}
      {showAddEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xl">
            <h3 className="text-base font-bold text-[var(--ink-primary)]">
              Ghi nhận mốc sự kiện mới cho {selectedOrder.orderCode}
            </h3>

            <form onSubmit={handleAddMilestone} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                  Trạng thái đơn hàng chuyển tiếp:
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as SalesOrderStatus)}
                  className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 font-mono"
                >
                  <option value="IN_PRODUCTION">IN_PRODUCTION (Đang sản xuất xưởng)</option>
                  <option value="PICKING">PICKING (Đang nhặt hàng xuất kho)</option>
                  <option value="PACKED">PACKED (Đã đóng gói bao bì)</option>
                  <option value="SHIPPED">SHIPPED (Đã bàn giao vận chuyển)</option>
                  <option value="DELIVERED">DELIVERED (Giao thành công)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                  Tiêu đề sự kiện:
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Hoàn tất in 5,000 cái, chuyển bộ phận đóng gói"
                  value={newTitle}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    if (eventError) setEventError(null);
                  }}
                  className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-[var(--ink-primary)]"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                  Ghi chú chi tiết:
                </label>
                <textarea
                  rows={3}
                  placeholder="Ghi chú thêm về ca trực, biên bản hoặc mã vận đơn..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-[var(--ink-primary)]"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                  Nhân sự phụ trách:
                </label>
                <input
                  type="text"
                  value={newActor}
                  onChange={(e) => setNewActor(e.target.value)}
                  className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-[var(--ink-primary)]"
                />
              </div>

              {eventError && (
                <div className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{eventError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-[var(--border-default)] pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddEventModal(false)}
                  className="rounded-md border border-[var(--border-default)] px-3 py-1.5 font-medium text-[var(--ink-secondary)] hover:bg-[var(--bg-muted)]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-[var(--brand)] px-4 py-1.5 font-medium text-[var(--ink-inverse)] shadow-xs hover:bg-[var(--brand-hover)]"
                >
                  Xác nhận lưu mốc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

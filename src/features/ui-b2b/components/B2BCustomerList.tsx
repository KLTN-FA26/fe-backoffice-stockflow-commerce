"use client";

import { useState } from "react";
import { 
  Plus, 
  Search, 
  Mail, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Building2, 
  ShieldCheck, 
  X
} from "lucide-react";
import { B2BCustomer } from "../types";
import { b2bRepo } from "../mock-repo";

interface Props {
  onSelectCustomerActivation: (token: string) => void;
  onRefresh: () => void;
}

export function B2BCustomerList({ onSelectCustomerActivation, onRefresh }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [companyName, setCompanyName] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [paymentTerm, setPaymentTerm] = useState<B2BCustomer["paymentTerm"]>("NET_30");
  const [creditLimit, setCreditLimit] = useState(200000000);

  const customers = b2bRepo.getCustomers(searchTerm);

  const handleSendInvite = (cust: B2BCustomer) => {
    b2bRepo.sendCustomerInvite(cust.id);
    onRefresh();
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    b2bRepo.createCustomer({
      companyName,
      taxCode,
      email,
      phone,
      address,
      contactPerson,
      contactPhone,
      paymentTerm,
      creditLimit: Number(creditLimit),
    });
    setShowCreateModal(false);
    onRefresh();
  };

  const getStatusBadge = (status: B2BCustomer["portalStatus"]) => {
    switch (status) {
      case "ACTIVE":
        return <span className="rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 text-xs font-semibold">Đã kích hoạt</span>;
      case "INVITED":
        return <span className="rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 text-xs font-semibold">Đã gửi thư mời</span>;
      case "EXPIRED":
        return <span className="rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 text-xs font-semibold">Lời mời hết hạn</span>;
      default:
        return <span className="rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 text-xs font-semibold">Chưa mời</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--ink-primary)] flex items-center gap-2">
            <Building2 className="h-5 w-5 text-sky-600" />
            <span>Quản Lý Khách Hàng Doanh Nghiệp B2B & Onboarding (SCRUM-451)</span>
          </h2>
          <p className="text-xs text-[var(--ink-secondary)]">
            Hồ sơ pháp nhân doanh nghiệp do Sales khởi tạo trực tiếp, gửi thư mời kích hoạt portal (loại bỏ hoàn toàn guest checkout).
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-md bg-[var(--brand)] px-3 py-2 text-xs font-medium text-[var(--ink-inverse)] hover:bg-[var(--brand-hover)] shadow-xs flex items-center gap-1.5 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Tạo Khách hàng B2B mới</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--ink-tertiary)]" />
          <input
            type="text"
            placeholder="Tìm theo tên doanh nghiệp, mã số thuế, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] pl-8 pr-3 py-1.5 text-xs text-[var(--ink-primary)]"
          />
        </div>
      </div>

      {/* Customer Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--ink-secondary)] font-medium">
            <tr>
              <th className="py-2.5 px-3">Mã KH / Doanh nghiệp</th>
              <th className="py-2.5 px-3">Mã số thuế</th>
              <th className="py-2.5 px-3">Người liên hệ</th>
              <th className="py-2.5 px-3">Điều khoản / Hạn mức</th>
              <th className="py-2.5 px-3">Trạng thái Portal</th>
              <th className="py-2.5 px-3 text-right">Thao tác thư mời</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-[var(--bg-subtle)] transition-colors">
                <td className="py-2.5 px-3">
                  <div className="font-bold text-[var(--ink-primary)]">{c.companyName}</div>
                  <div className="font-mono text-[11px] text-[var(--ink-tertiary)]">{c.code} · {c.email}</div>
                </td>
                <td className="py-2.5 px-3 font-mono font-medium text-[var(--ink-primary)]">
                  {c.taxCode}
                </td>
                <td className="py-2.5 px-3">
                  <div className="font-medium text-[var(--ink-primary)]">{c.contactPerson}</div>
                  <div className="text-[11px] text-[var(--ink-tertiary)]">{c.contactPhone}</div>
                </td>
                <td className="py-2.5 px-3">
                  <div className="font-semibold text-sky-700 dark:text-sky-400">{c.paymentTerm}</div>
                  <div className="font-mono text-[11px] text-[var(--ink-secondary)]">
                    Hạn mức: {(c.creditLimit / 1000000).toLocaleString()}M đ
                  </div>
                </td>
                <td className="py-2.5 px-3">
                  {getStatusBadge(c.portalStatus)}
                  {c.inviteSentAt && (
                    <div className="text-[10px] text-[var(--ink-tertiary)] mt-0.5">
                      Gửi: {c.inviteSentAt}
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                  {c.portalStatus === "NOT_INVITED" && (
                    <button
                      onClick={() => handleSendInvite(c)}
                      className="rounded bg-sky-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-700 shadow-xs inline-flex items-center gap-1"
                    >
                      <Send className="h-3 w-3" />
                      <span>Gửi thư mời</span>
                    </button>
                  )}

                  {(c.portalStatus === "INVITED" || c.portalStatus === "EXPIRED") && (
                    <button
                      onClick={() => handleSendInvite(c)}
                      className="rounded border border-[var(--border-default)] px-2 py-1 text-[11px] font-medium text-[var(--ink-secondary)] hover:bg-[var(--bg-muted)] inline-flex items-center gap-1"
                    >
                      <Mail className="h-3 w-3" />
                      <span>Gửi lại</span>
                    </button>
                  )}

                  {c.inviteToken && (
                    <button
                      onClick={() => onSelectCustomerActivation(c.inviteToken!)}
                      className="rounded bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 px-2 py-1 text-[11px] font-medium hover:bg-purple-100 inline-flex items-center gap-1"
                      title="Mô phỏng mở link kích hoạt của khách hàng"
                    >
                      <span>Mở link kích hoạt</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Create Customer */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-sky-600" />
                <h3 className="text-base font-bold text-[var(--ink-primary)]">
                  Thêm Khách Hàng Doanh Nghiệp B2B
                </h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-[var(--ink-primary)] font-medium mb-1">Tên pháp nhân công ty (*):</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Công ty Cổ phần Thương mại & Dịch vụ Tân Á"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--ink-primary)] font-medium mb-1">Mã số thuế (*):</label>
                  <input
                    type="text"
                    required
                    placeholder="0312998811"
                    value={taxCode}
                    onChange={(e) => setTaxCode(e.target.value)}
                    className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[var(--ink-primary)] font-medium mb-1">Email nhận thư mời (*):</label>
                  <input
                    type="email"
                    required
                    placeholder="finance@company.vn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--ink-secondary)] mb-1">Người đại diện liên hệ:</label>
                  <input
                    type="text"
                    required
                    placeholder="Họ và tên..."
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[var(--ink-secondary)] mb-1">Điện thoại liên hệ:</label>
                  <input
                    type="text"
                    required
                    placeholder="0908 123 456"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[var(--ink-secondary)] mb-1">Địa chỉ trụ sở công ty:</label>
                <input
                  type="text"
                  required
                  placeholder="Địa chỉ xuất hóa đơn GTGT..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--ink-secondary)] mb-1">Điều khoản công nợ thỏa thuận:</label>
                  <select
                    value={paymentTerm}
                    onChange={(e) => setPaymentTerm(e.target.value as B2BCustomer["paymentTerm"])}
                    className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs"
                  >
                    <option value="NET_15">Net 15 ngày</option>
                    <option value="NET_30">Net 30 ngày (Tiêu chuẩn)</option>
                    <option value="NET_60">Net 60 ngày</option>
                    <option value="COD">Thanh toán khi nhận hàng (COD)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--ink-secondary)] mb-1">Hạn mức công nợ (VNĐ):</label>
                  <input
                    type="number"
                    min="0"
                    step="10000000"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(Number(e.target.value))}
                    className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-default)]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded border border-[var(--border-default)] px-3 py-1.5 text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded bg-[var(--brand)] px-4 py-1.5 font-medium text-[var(--ink-inverse)] hover:bg-[var(--brand-hover)] shadow-xs"
                >
                  Lưu khách hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

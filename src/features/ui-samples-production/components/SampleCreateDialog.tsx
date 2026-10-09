"use client";

import { useState } from "react";
import { X, Plus, Sparkles } from "lucide-react";
import { samplesProductionRepo } from "../mock-repo";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function SampleCreateDialog({ isOpen, onClose, onCreated }: Props) {
  const [customerName, setCustomerName] = useState("");
  const [customerCode, setCustomerCode] = useState("CUST-" + Math.floor(100 + Math.random() * 900));
  const [customerEmail, setCustomerEmail] = useState("");
  const [blankSku, setBlankSku] = useState("LY-GIAY-350-TRANG");
  const [designName, setDesignName] = useState("");
  const [technology, setTechnology] = useState("In Flexo UV 4 màu");
  const [colors, setColors] = useState("CMYK, Pantone 185C");
  const [dimensions, setDimensions] = useState("85mm x 115mm");
  const [sampleQuantity, setSampleQuantity] = useState(20);
  const [dueDate, setDueDate] = useState("2026-10-18");
  const [linkedQuoteCode, setLinkedQuoteCode] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !designName || !sampleQuantity) {
      alert("Vui lòng điền các trường bắt buộc");
      return;
    }

    const blankNames: Record<string, string> = {
      "LY-GIAY-350-TRANG": "Ly giấy trơn hai lớp 350ml PE",
      "LY-NHUA-PP-500": "Ly nhựa PP mờ sần 500ml",
      "TO-GIAY-750-KRAFT": "Tô giấy Kraft 750ml chống thấm",
      "LY-NHUA-PET-700": "Ly nhựa PET trong 700ml",
    };

    samplesProductionRepo.createSampleRequest({
      customerName,
      customerCode,
      customerEmail: customerEmail || `${customerCode.toLowerCase()}@example.com`,
      blankSku,
      blankName: blankNames[blankSku] || "Phôi tiêu chuẩn StockFlow",
      designName,
      designSnapshotUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80",
      printSpec: {
        technology,
        colors: colors.split(",").map(c => c.trim()),
        dimensions,
        checksum: "sha256:" + Math.random().toString(36).substring(2, 15),
      },
      sampleQuantity: Number(sampleQuantity),
      dueDate,
      linkedQuoteCode: linkedQuoteCode || undefined,
    });

    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-base font-bold text-[var(--ink-primary)]">Tạo Yêu cầu Làm mẫu Thử (Sample Request)</h3>
          </div>
          <button onClick={onClose} className="rounded p-1 text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--ink-secondary)] mb-1 font-medium">Tên khách hàng / Công ty (*):</label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Cà phê Highland Heritage"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)]"
              />
            </div>
            <div>
              <label className="block text-[var(--ink-secondary)] mb-1 font-medium">Email khách hàng:</label>
              <input
                type="email"
                placeholder="contact@customer.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[var(--ink-secondary)] mb-1 font-medium">Tên mẫu thiết kế (*):</label>
            <input
              type="text"
              required
              placeholder="Ví dụ: Logo Mùa Thu 2026 Gold Special"
              value={designName}
              onChange={(e) => setDesignName(e.target.value)}
              className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--ink-secondary)] mb-1 font-medium">Mã phôi SKU (*):</label>
              <select
                value={blankSku}
                onChange={(e) => setBlankSku(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)]"
              >
                <option value="LY-GIAY-350-TRANG">LY-GIAY-350-TRANG (Ly giấy 350ml)</option>
                <option value="LY-NHUA-PP-500">LY-NHUA-PP-500 (Ly PP 500ml)</option>
                <option value="TO-GIAY-750-KRAFT">TO-GIAY-750-KRAFT (Tô Kraft 750ml)</option>
                <option value="LY-NHUA-PET-700">LY-NHUA-PET-700 (Ly PET 700ml)</option>
              </select>
            </div>
            <div>
              <label className="block text-[var(--ink-secondary)] mb-1 font-medium">Công nghệ in:</label>
              <input
                type="text"
                value={technology}
                onChange={(e) => setTechnology(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--ink-secondary)] mb-1 font-medium">Hệ màu / Spot:</label>
              <input
                type="text"
                value={colors}
                onChange={(e) => setColors(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)]"
              />
            </div>
            <div>
              <label className="block text-[var(--ink-secondary)] mb-1 font-medium">Kích thước in:</label>
              <input
                type="text"
                value={dimensions}
                onChange={(e) => setDimensions(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[var(--ink-secondary)] mb-1 font-medium">SL mẫu thử (*):</label>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={sampleQuantity}
                onChange={(e) => setSampleQuantity(Number(e.target.value))}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)]"
              />
            </div>
            <div>
              <label className="block text-[var(--ink-secondary)] mb-1 font-medium">Hạn giao mẫu (*):</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)]"
              />
            </div>
            <div>
              <label className="block text-[var(--ink-secondary)] mb-1 font-medium">Mã báo giá:</label>
              <input
                type="text"
                placeholder="BG-2026-..."
                value={linkedQuoteCode}
                onChange={(e) => setLinkedQuoteCode(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)] font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-default)]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="rounded-md bg-[var(--brand)] px-4 py-1.5 text-xs font-medium text-[var(--ink-inverse)] hover:bg-[var(--brand-hover)] shadow-xs"
            >
              Tạo yêu cầu mẫu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

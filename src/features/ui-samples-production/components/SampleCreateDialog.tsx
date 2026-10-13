"use client";

import { useState } from "react";
import { X, Sparkles, AlertCircle } from "lucide-react";
import { samplesProductionRepo } from "../mock-repo";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function SampleCreateDialog({ isOpen, onClose, onCreated }: Props) {
  const [customerName, setCustomerName] = useState("");
  const customerCode = "CUST-108";
  const [customerEmail, setCustomerEmail] = useState("");
  const [blankSku, setBlankSku] = useState("LY-GIAY-350-TRANG");
  const [designName, setDesignName] = useState("");
  const [technology, setTechnology] = useState("In Flexo UV 4 màu");
  const [colors, setColors] = useState("CMYK, Pantone 185C");
  const [dimensions, setDimensions] = useState("85mm x 115mm");
  const [sampleQuantity, setSampleQuantity] = useState(20);
  const [dueDate, setDueDate] = useState("2026-10-18");
  const [linkedQuoteCode, setLinkedQuoteCode] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !designName.trim() || !sampleQuantity) {
      setValidationError(
        "Vui lòng điền đầy đủ các trường bắt buộc (*): Khách hàng, Tên thiết kế và Số lượng mẫu!",
      );
      return;
    }
    setValidationError(null);

    const blankNames: Record<string, string> = {
      "LY-GIAY-350-TRANG": "Ly giấy trơn hai lớp 350ml PE",
      "LY-NHUA-PP-500": "Ly nhựa PP mờ sần 500ml",
      "TO-GIAY-750-KRAFT": "Tô giấy Kraft 750ml chống thấm",
      "LY-NHUA-PET-700": "Ly nhựa PET trong 700ml",
    };

    samplesProductionRepo.createSampleRequest({
      customerName,
      customerCode: customerCode || "CUST-GEN-01",
      customerEmail: customerEmail || `${customerCode.toLowerCase()}@example.com`,
      blankSku,
      blankName: blankNames[blankSku] || "Phôi tiêu chuẩn StockFlow",
      designName,
      designSnapshotUrl:
        "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80",
      printSpec: {
        technology,
        colors: colors.split(",").map((c) => c.trim()),
        dimensions,
        checksum: "sha256:d8a2f019b7c89e21",
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
      <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-base font-bold text-[var(--ink-primary)]">
              Tạo Yêu cầu Làm mẫu Thử (Sample Request)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                Tên khách hàng / Công ty (*):
              </label>
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
              <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                Email khách hàng:
              </label>
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
            <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
              Tên mẫu thiết kế (*):
            </label>
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
              <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                Mã phôi SKU (*):
              </label>
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
              <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                Công nghệ in:
              </label>
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
              <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                Hệ màu / Spot:
              </label>
              <input
                type="text"
                value={colors}
                onChange={(e) => setColors(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)]"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                Kích thước in:
              </label>
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
              <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                SL mẫu thử (*):
              </label>
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
              <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                Hạn giao mẫu (*):
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)]"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                Mã báo giá:
              </label>
              <input
                type="text"
                placeholder="BG-2026-..."
                value={linkedQuoteCode}
                onChange={(e) => setLinkedQuoteCode(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 font-mono text-xs text-[var(--ink-primary)]"
              />
            </div>
          </div>

          {validationError && (
            <div className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-[var(--border-default)] pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="rounded-md bg-[var(--brand)] px-4 py-1.5 text-xs font-medium text-[var(--ink-inverse)] shadow-xs hover:bg-[var(--brand-hover)]"
            >
              Tạo yêu cầu mẫu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import {
  Calculator,
  Sparkles,
  Palette,
  TrendingDown,
  Package,
  FileSpreadsheet,
  Printer,
  Copy,
  Check,
  X,
  FileText,
} from "lucide-react";
import { batch2Repo } from "../mock-repo";
import {
  CustomizationPricingParams,
  PrintTechnology,
  SurfaceFinish,
  PriceCalculationResult,
} from "../types";

const PACKAGING_OPTIONS = [
  { sku: "LY-GIAY-500-KRAFT", name: "Ly giấy Kraft 500ml cách nhiệt", basePrice: 1650 },
  { sku: "TO-GIAY-750-KRAFT", name: "Tô giấy Kraft 750ml chống thấm PE", basePrice: 2400 },
  { sku: "HOP-COM-1000-KRAFT", name: "Hộp cơm giấy Kraft 1000ml nắp gài", basePrice: 3200 },
  { sku: "LY-NHUA-PP-500", name: "Ly nhựa PP 500ml mờ sần", basePrice: 1200 },
];

const VOLUME_TIERS = [1000, 3000, 5000, 10000, 20000];

export function CustomizationPriceCalculator() {
  const [selectedSku, setSelectedSku] = useState(PACKAGING_OPTIONS[0].sku);
  const [quantity, setQuantity] = useState(5000);
  const [printTech, setPrintTech] = useState<PrintTechnology>("FLEXO");
  const [colorCount, setColorCount] = useState(2);
  const [surfaceFinish, setSurfaceFinish] = useState<SurfaceFinish>("MATTE_LAMINATION");
  const [isDoubleSided, setIsDoubleSided] = useState(false);
  const [showSpecModal, setShowSpecModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentPackaging =
    PACKAGING_OPTIONS.find((p) => p.sku === selectedSku) || PACKAGING_OPTIONS[0];

  const pricingParams: CustomizationPricingParams = useMemo(
    () => ({
      basePackagingSku: currentPackaging.sku,
      basePackagingName: currentPackaging.name,
      baseUnitPrice: currentPackaging.basePrice,
      quantity,
      printTechnology: printTech,
      colorCount,
      surfaceFinish,
      isDoubleSided,
    }),
    [currentPackaging, quantity, printTech, colorCount, surfaceFinish, isDoubleSided],
  );

  const result: PriceCalculationResult = useMemo(() => {
    return batch2Repo.calculateCustomizationPrice(pricingParams);
  }, [pricingParams]);

  // Volume comparison table generator
  const tierComparison = useMemo(() => {
    return VOLUME_TIERS.map((q) => {
      const res = batch2Repo.calculateCustomizationPrice({ ...pricingParams, quantity: q });
      return {
        qty: q,
        unitPrice: res.effectiveUnitPrice,
        total: res.finalTotal,
        discount: res.volumeDiscountPercent,
        plateFee: res.plateCylinderFee,
      };
    });
  }, [pricingParams]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink-primary)]">
          <Calculator className="h-5 w-5 text-indigo-600" />
          <span>
            Bảng Tính Giá Tùy Biến Sản Phẩm In Ấn (Live Customization Price Calculator — SCRUM-304)
          </span>
        </h2>
        <p className="text-xs text-[var(--ink-secondary)]">
          Động cơ tính giá trực tiếp theo thông số in: công nghệ in, số màu mực, kỹ thuật gia công
          bề mặt và chiết khấu bậc sản lượng (Khác với Báo giá B2B 449).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Interactive Parameter Controls */}
        <div className="space-y-5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 text-xs shadow-xs lg:col-span-2">
          {/* 1. Base Packaging Product */}
          <div>
            <label className="mb-2 block flex items-center gap-1.5 font-bold text-[var(--ink-primary)]">
              <Package className="h-4 w-4 text-[var(--brand)]" />
              <span>1. Chọn loại bao bì / phôi cơ bản:</span>
            </label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {PACKAGING_OPTIONS.map((pkg) => (
                <button
                  key={pkg.sku}
                  type="button"
                  onClick={() => setSelectedSku(pkg.sku)}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    selectedSku === pkg.sku
                      ? "border-[var(--brand)] bg-[var(--bg-muted)] shadow-xs"
                      : "border-[var(--border-default)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-muted)]"
                  }`}
                >
                  <div className="font-semibold text-[var(--ink-primary)]">{pkg.name}</div>
                  <div className="mt-1 flex justify-between text-[11px] text-[var(--ink-secondary)]">
                    <span className="font-mono">{pkg.sku}</span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {pkg.basePrice.toLocaleString()} đ/phôi
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Order Quantity Tier */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="font-bold text-[var(--ink-primary)]">
                2. Số lượng đặt in (Càng lớn đơn giá càng giảm):
              </label>
              <span className="font-mono text-sm font-bold text-[var(--brand)]">
                {quantity.toLocaleString()} cái
              </span>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {[1000, 3000, 5000, 10000, 20000, 50000].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuantity(q)}
                  className={`rounded-md px-3 py-1.5 font-mono text-xs font-semibold transition-all ${
                    quantity === q
                      ? "bg-[var(--brand)] text-[var(--ink-inverse)] shadow-xs"
                      : "border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--ink-primary)] hover:bg-[var(--bg-muted)]"
                  }`}
                >
                  {q.toLocaleString()} cái
                </button>
              ))}
            </div>

            <input
              type="range"
              min="1000"
              max="50000"
              step="500"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full accent-[var(--brand)]"
            />
          </div>

          {/* 3. Print Technology & Color Count */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block flex items-center gap-1.5 font-bold text-[var(--ink-primary)]">
                <Palette className="h-4 w-4 text-[var(--brand)]" />
                <span>3. Công nghệ in ấn:</span>
              </label>
              <select
                value={printTech}
                onChange={(e) => setPrintTech(e.target.value as PrintTechnology)}
                className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 font-medium text-[var(--ink-primary)]"
              >
                <option value="FLEXO">In Flexo (Trục polymer — Tối ưu cuộn lớn)</option>
                <option value="SILKSCREEN">In Lụa (Khung lưới — Tối ưu đơn vừa & 1-2 màu)</option>
                <option value="OFFSET">In Offset (Bản kẽm sắc nét chuẩn ảnh)</option>
                <option value="UV">In UV nổi (Cao cấp chống trầy bóng mờ)</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block font-bold text-[var(--ink-primary)]">
                4. Số lượng màu in (Color Count):
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                {[1, 2, 3, 4, 5, 6].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColorCount(c)}
                    className={`rounded-md py-2 text-center font-mono text-xs font-bold transition-colors ${
                      colorCount === c
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--ink-primary)] hover:bg-[var(--bg-muted)]"
                    }`}
                  >
                    {c} màu
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Surface Finish & Double Sided */}
          <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2">
            <div>
              <label className="mb-2 block flex items-center gap-1.5 font-bold text-[var(--ink-primary)]">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>5. Gia công bề mặt (Surface Finish):</span>
              </label>
              <select
                value={surfaceFinish}
                onChange={(e) => setSurfaceFinish(e.target.value as SurfaceFinish)}
                className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 font-medium text-[var(--ink-primary)]"
              >
                <option value="NONE">Không gia công màng</option>
                <option value="GLOSS_LAMINATION">Cán màng bóng (Gloss Lamination)</option>
                <option value="MATTE_LAMINATION">Cán màng mờ (Matte Lamination)</option>
                <option value="FOIL_GOLD">Ép kim nhũ vàng (Gold Foil Stamping)</option>
                <option value="EMBOSSING">Dập nổi họa tiết (Embossing)</option>
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3">
                <input
                  type="checkbox"
                  checked={isDoubleSided}
                  onChange={(e) => setIsDoubleSided(e.target.checked)}
                  className="h-4 w-4 rounded text-[var(--brand)]"
                />
                <div>
                  <span className="block font-semibold text-[var(--ink-primary)]">
                    In 2 mặt đối xứng
                  </span>
                  <span className="text-[10px] text-[var(--ink-tertiary)]">
                    Nhân hệ số 1.5 chi phí khuôn và lượt in
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Col: Live Price Breakdown Result */}
        <div className="flex flex-col justify-between space-y-6 rounded-lg border border-[var(--brand)] bg-[var(--bg-surface)] p-6 shadow-md">
          <div>
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <h3 className="text-base font-bold text-[var(--ink-primary)]">
                Dự Toán Giá Tức Thời
              </h3>
              <span className="rounded bg-indigo-100 px-2 py-0.5 font-mono text-[10px] font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                LIVE RECALC
              </span>
            </div>

            {/* Big Unit Price Display */}
            <div className="mt-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-muted)] p-4 text-center">
              <span className="block text-[11px] font-bold tracking-wider text-[var(--ink-tertiary)] uppercase">
                Đơn giá bình quân mỗi sản phẩm
              </span>
              <div className="mt-1 font-mono text-3xl font-extrabold text-[var(--brand)]">
                {result.effectiveUnitPrice.toLocaleString()}{" "}
                <span className="text-base font-medium">đ/cái</span>
              </div>
              {result.volumeDiscountPercent > 0 && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <TrendingDown className="h-3 w-3" />
                  <span>Đã giảm {result.volumeDiscountPercent}% theo bậc số lượng</span>
                </div>
              )}
            </div>

            {/* Itemized Cost Breakdown */}
            <div className="mt-5 space-y-2.5 text-xs">
              <div className="flex justify-between text-[var(--ink-secondary)]">
                <span>1. Tiền phôi sản phẩm ({quantity.toLocaleString()} cái):</span>
                <span className="font-mono text-[var(--ink-primary)]">
                  {result.baseMaterialCost.toLocaleString()} đ
                </span>
              </div>
              <div className="flex justify-between text-[var(--ink-secondary)]">
                <span>
                  2. Phí bản in/khuôn ({colorCount} màu {printTech}):
                </span>
                <span className="font-mono text-[var(--ink-primary)]">
                  {result.plateCylinderFee.toLocaleString()} đ
                </span>
              </div>
              <div className="flex justify-between text-[var(--ink-secondary)]">
                <span>3. Phí lượt in chạy máy:</span>
                <span className="font-mono text-[var(--ink-primary)]">
                  {result.runChargePrint.toLocaleString()} đ
                </span>
              </div>
              <div className="flex justify-between text-[var(--ink-secondary)]">
                <span>4. Phí gia công bề mặt:</span>
                <span className="font-mono text-[var(--ink-primary)]">
                  {result.finishCost.toLocaleString()} đ
                </span>
              </div>

              {result.volumeDiscountAmount > 0 && (
                <div className="flex justify-between border-t border-[var(--border-default)] pt-2 font-medium text-emerald-700 dark:text-emerald-400">
                  <span>Chiết khấu số lượng ({result.volumeDiscountPercent}%):</span>
                  <span className="font-mono">
                    -{result.volumeDiscountAmount.toLocaleString()} đ
                  </span>
                </div>
              )}

              <div className="flex justify-between border-t-2 border-[var(--border-strong)] pt-3 text-sm font-bold text-[var(--ink-primary)]">
                <span>Tổng chi phí đơn hàng:</span>
                <span className="font-mono text-base text-[var(--brand)]">
                  {result.finalTotal.toLocaleString()} đ
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSpecModal(true)}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--brand)] py-2.5 text-xs font-bold text-[var(--ink-inverse)] shadow-xs transition-colors hover:bg-[var(--brand-hover)]"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Xem & Trích xuất phiếu thông số kỹ thuật</span>
          </button>
        </div>
      </div>

      {/* Volume Tiers Comparison Table */}
      <div className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-primary)]">
          <FileSpreadsheet className="h-4 w-4 text-[var(--brand)]" />
          <span>Bảng So Sánh Đơn Giá Theo Các Bậc Sản Lượng (Volume Pricing Matrix)</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-default)] bg-[var(--bg-muted)] font-semibold text-[var(--ink-secondary)]">
              <tr>
                <th className="px-3 py-2">Bậc số lượng</th>
                <th className="px-3 py-2 text-right">Phí bản in/khuôn</th>
                <th className="px-3 py-2 text-center">Chiết khấu</th>
                <th className="px-3 py-2 text-right">Đơn giá / cái</th>
                <th className="px-3 py-2 text-right">Tổng thành tiền</th>
                <th className="px-3 py-2 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {tierComparison.map((t) => {
                const isCurrent = t.qty === quantity;
                return (
                  <tr
                    key={t.qty}
                    className={`transition-colors ${
                      isCurrent
                        ? "bg-amber-50/70 font-bold dark:bg-amber-950/30"
                        : "hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    <td className="px-3 py-2 font-mono">
                      {t.qty.toLocaleString()} cái
                      {isCurrent && (
                        <span className="ml-2 text-[10px] text-amber-600">● Đang chọn</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[var(--ink-secondary)]">
                      {t.plateFee.toLocaleString()} đ
                    </td>
                    <td className="px-3 py-2 text-center">
                      {t.discount > 0 ? (
                        <span className="py-0.2 rounded bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          -{t.discount}%
                        </span>
                      ) : (
                        <span className="text-[var(--ink-tertiary)]">0%</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-indigo-700 dark:text-indigo-400">
                      {t.unitPrice.toLocaleString()} đ
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-[var(--ink-primary)]">
                      {t.total.toLocaleString()} đ
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setQuantity(t.qty)}
                        disabled={isCurrent}
                        className="rounded border border-[var(--border-default)] px-2 py-0.5 text-[11px] hover:bg-[var(--bg-muted)] disabled:opacity-30"
                      >
                        Chọn bậc này
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Spec Sheet Modal */}
      {showSpecModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-bold text-[var(--ink-primary)]">
                  Phiếu Kỹ Thuật Định Lượng & Báo Giá In Ấn
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowSpecModal(false);
                  setCopied(false);
                }}
                className="rounded p-1 text-[var(--ink-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--ink-primary)]"
                aria-label="Đóng bảng thông số"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3">
                <div className="flex justify-between">
                  <span className="text-[var(--ink-secondary)]">Phôi bao bì:</span>
                  <span className="font-bold text-[var(--ink-primary)]">
                    {currentPackaging.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-secondary)]">Mã SKU:</span>
                  <span className="font-mono font-bold">{currentPackaging.sku}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-secondary)]">Số lượng đặt:</span>
                  <span className="font-mono font-bold tabular-nums">
                    {quantity.toLocaleString()} cái
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-secondary)]">Công nghệ in:</span>
                  <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                    {printTech === "FLEXO"
                      ? "In Flexo cuộn"
                      : printTech === "SILKSCREEN"
                        ? "In Lụa thủ công"
                        : "In Offset tờ rơi"}{" "}
                    ({colorCount} màu)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-secondary)]">Hoàn thiện bề mặt:</span>
                  <span className="font-medium">
                    {surfaceFinish === "NONE"
                      ? "Không cán màng"
                      : surfaceFinish === "MATTE_LAMINATION"
                        ? "Cán màng mờ"
                        : surfaceFinish === "GLOSS_LAMINATION"
                          ? "Cán màng bóng"
                          : "Ép kim nhũ"}
                  </span>
                </div>
              </div>

              {/* Cost breakdown */}
              <div className="space-y-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="font-sans text-[var(--ink-secondary)]">Chi phí phôi trắng:</span>
                  <span className="tabular-nums">{result.baseMaterialCost.toLocaleString()} đ</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-[var(--ink-secondary)]">
                    Phí khuôn & chế bản in:
                  </span>
                  <span className="tabular-nums">
                    {result.plateCylinderFee === 0
                      ? "0 đ (Miễn phí từ 10k)"
                      : `${result.plateCylinderFee.toLocaleString()} đ`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-[var(--ink-secondary)]">
                    Công in ấn {colorCount} màu:
                  </span>
                  <span className="tabular-nums">{result.runChargePrint.toLocaleString()} đ</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-[var(--ink-secondary)]">
                    Gia công cán màng/ép kim:
                  </span>
                  <span className="tabular-nums">{result.finishCost.toLocaleString()} đ</span>
                </div>
                {result.volumeDiscountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span className="font-sans">Chiết khấu số lượng:</span>
                    <span className="tabular-nums">
                      - {result.volumeDiscountAmount.toLocaleString()} đ
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-[var(--border-default)] pt-2 text-xs font-bold text-[var(--ink-primary)]">
                  <span className="font-sans">Đơn giá thành phẩm:</span>
                  <span className="text-emerald-700 tabular-nums dark:text-emerald-400">
                    {result.effectiveUnitPrice.toLocaleString()} đ/cái
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[var(--brand)]">
                  <span className="font-sans">Tổng giá trị đơn hàng:</span>
                  <span className="tabular-nums">{result.finalTotal.toLocaleString()} đ</span>
                </div>
              </div>

              <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <strong>Giả định Demo:</strong> Công thức tính phí khuôn và chiết khấu bậc sản lượng
                là tham số mẫu phục vụ trình diễn định mức xưởng in bao bì.
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Thông số in ấn: ${currentPackaging.name} | SL: ${quantity} | Đơn giá: ${result.effectiveUnitPrice}đ | Tổng: ${result.finalTotal}đ`,
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--ink-secondary)] hover:bg-[var(--bg-muted)]"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copied ? "Đã sao chép!" : "Sao chép thông số"}</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSpecModal(false);
                    setCopied(false);
                  }}
                  className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--ink-secondary)] hover:bg-[var(--bg-muted)]"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>In phiếu định mức</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  Maximize2,
  Move,
  Sliders,
  AlertCircle,
  Lock,
  Unlock,
  FileCode,
  Download,
  CheckCircle2,
  X,
} from "lucide-react";
import { batch2Repo } from "../mock-repo";

export function PackagingDesignCanvas() {
  const session = batch2Repo.getDieCutSession();
  const [mouthMm, setMouthMm] = useState(session.dimensions.mouthDiameterMm);
  const [bottomMm, setBottomMm] = useState(session.dimensions.bottomDiameterMm);
  const [heightMm, setHeightMm] = useState(session.dimensions.heightMm);
  const [bleedMm, setBleedMm] = useState(session.dimensions.bleedMarginMm);
  const [selectedArtId, setSelectedArtId] = useState<string>(session.artworkElements[0]?.id || "");
  const [isLocked, setIsLocked] = useState(session.isLockedForPrepress);
  const [showExportModal, setShowExportModal] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const selectedArtwork =
    session.artworkElements.find((a) => a.id === selectedArtId) || session.artworkElements[0];

  const handleDimensionChange = (m: number, b: number, h: number, bl: number) => {
    setMouthMm(m);
    setBottomMm(b);
    setHeightMm(h);
    setBleedMm(bl);
    batch2Repo.updateDieCutDimensions(m, b, h, bl);
    setTick((t) => t + 1);
  };

  const handleUpdateArtwork = (x: number, y: number, scale: number, rotation: number) => {
    if (isLocked) return;
    batch2Repo.updateArtworkPosition(selectedArtwork.id, x, y, scale, rotation);
    setTick((t) => t + 1);
  };

  const printableWidthMm = Math.round(Math.PI * mouthMm);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink-primary)]">
          <Maximize2 className="h-5 w-5 text-indigo-600" />
          <span>
            Khuôn Bế Trải Phẳng 2D & Thiết Kế Bố Cục In (2D Packaging Die-Cut Canvas — SCRUM-299 &
            300)
          </span>
        </h2>
        <p className="text-xs text-[var(--ink-secondary)]">
          Công cụ nhập quy cách kích thước phôi ly/hộp, hiển thị đường cắt bế (Die-Cut), vùng an
          toàn tràn viền (Bleed) và kéo thả bố cục logo in ấn.
        </p>
      </div>

      {/* Scope Ambiguity Reconciliation Banner */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <strong className="text-sm font-semibold">
                CHỜ QUYẾT ĐỊNH NGHIỆP VỤ — Scope Ambiguity (SCRUM-299 & SCRUM-300):
              </strong>
              <span className="rounded bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900 uppercase dark:bg-amber-900/80 dark:text-amber-200">
                Prototype Demo
              </span>
            </div>
            <p className="leading-relaxed">
              Mô tả gốc trong Jira SCRUM-299/300 đề cập đến &ldquo;bố cục phòng ốc nội thất (room
              outline / furniture items)&rdquo;, trong khi phạm vi xuyên suốt 18 module StockFlow là{" "}
              <strong>In ấn bao bì F&B (Cup & Packaging Printing)</strong>. Giao diện bên dưới là mô
              hình thử nghiệm khuôn bế 2D (Die-cut trải phẳng) phục vụ xưởng in bao bì.
              <strong> Lưu ý:</strong> Yêu cầu này giữ nguyên trạng thái{" "}
              <em>Chờ quyết định chính thức từ Product Owner / Giảng viên</em>, không tự ý gán là
              đạt chuẩn (Passed) khi chưa có văn bản phê duyệt.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Dimensions & Artwork Placement Controls */}
        <div className="space-y-5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 text-xs shadow-xs">
          {/* Dimensions Input (SCRUM-300) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2">
              <h3 className="flex items-center gap-1.5 font-bold text-[var(--ink-primary)]">
                <Sliders className="h-4 w-4 text-[var(--brand)]" />
                <span>1. Quy cách kích thước phôi (SCRUM-300)</span>
              </h3>
              <span className="font-mono text-[10px] font-bold text-indigo-700 dark:text-indigo-400">
                Chu vi: {printableWidthMm}mm
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[var(--ink-secondary)]">
                  Đường kính miệng (mm):
                </label>
                <input
                  type="number"
                  min="50"
                  max="200"
                  value={mouthMm}
                  disabled={isLocked}
                  onChange={(e) =>
                    handleDimensionChange(Number(e.target.value), bottomMm, heightMm, bleedMm)
                  }
                  className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 font-mono text-[var(--ink-primary)] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="mb-1 block text-[var(--ink-secondary)]">
                  Đường kính đáy (mm):
                </label>
                <input
                  type="number"
                  min="40"
                  max="180"
                  value={bottomMm}
                  disabled={isLocked}
                  onChange={(e) =>
                    handleDimensionChange(mouthMm, Number(e.target.value), heightMm, bleedMm)
                  }
                  className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 font-mono text-[var(--ink-primary)] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="mb-1 block text-[var(--ink-secondary)]">
                  Chiều cao thân ly (mm):
                </label>
                <input
                  type="number"
                  min="60"
                  max="250"
                  value={heightMm}
                  disabled={isLocked}
                  onChange={(e) =>
                    handleDimensionChange(mouthMm, bottomMm, Number(e.target.value), bleedMm)
                  }
                  className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 font-mono text-[var(--ink-primary)] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="mb-1 block text-[var(--ink-secondary)]">
                  Tràn viền Bleed (mm):
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={bleedMm}
                  disabled={isLocked}
                  onChange={(e) =>
                    handleDimensionChange(mouthMm, bottomMm, heightMm, Number(e.target.value))
                  }
                  className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 font-mono text-[var(--ink-primary)] disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Artwork Layer Controls (SCRUM-299) */}
          <div className="space-y-3 border-t border-[var(--border-default)] pt-2">
            <div className="flex items-center justify-between pb-1">
              <h3 className="flex items-center gap-1.5 font-bold text-[var(--ink-primary)]">
                <Move className="h-4 w-4 text-purple-600" />
                <span>2. Bố cục & Vị trí Artwork (SCRUM-299)</span>
              </h3>
            </div>

            <div className="flex gap-2">
              {session.artworkElements.map((art) => (
                <button
                  key={art.id}
                  type="button"
                  onClick={() => setSelectedArtId(art.id)}
                  className={`flex-1 rounded-md border p-2 text-left font-medium transition-colors ${
                    selectedArtId === art.id
                      ? "border-purple-600 bg-purple-50 text-purple-900 dark:bg-purple-950/40 dark:text-purple-200"
                      : "border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--ink-secondary)] hover:bg-[var(--bg-muted)]"
                  }`}
                >
                  <div className="truncate">{art.name}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-[var(--ink-tertiary)]">
                    {art.type}
                  </div>
                </button>
              ))}
            </div>

            {selectedArtwork && (
              <div className="space-y-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3">
                <div>
                  <div className="mb-1 flex justify-between">
                    <span className="text-[var(--ink-secondary)]">Vị trí ngang (Tọa độ X):</span>
                    <span className="font-mono font-bold">{selectedArtwork.x}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="95"
                    disabled={isLocked}
                    value={selectedArtwork.x}
                    onChange={(e) =>
                      handleUpdateArtwork(
                        Number(e.target.value),
                        selectedArtwork.y,
                        selectedArtwork.scale,
                        selectedArtwork.rotation,
                      )
                    }
                    className="w-full accent-purple-600"
                  />
                </div>

                <div>
                  <div className="mb-1 flex justify-between">
                    <span className="text-[var(--ink-secondary)]">Vị trí dọc (Tọa độ Y):</span>
                    <span className="font-mono font-bold">{selectedArtwork.y}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    disabled={isLocked}
                    value={selectedArtwork.y}
                    onChange={(e) =>
                      handleUpdateArtwork(
                        selectedArtwork.x,
                        Number(e.target.value),
                        selectedArtwork.scale,
                        selectedArtwork.rotation,
                      )
                    }
                    className="w-full accent-purple-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[var(--ink-secondary)]">
                      Tỷ lệ Scale (x):
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="2.5"
                      disabled={isLocked}
                      value={selectedArtwork.scale}
                      onChange={(e) =>
                        handleUpdateArtwork(
                          selectedArtwork.x,
                          selectedArtwork.y,
                          Number(e.target.value),
                          selectedArtwork.rotation,
                        )
                      }
                      className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-surface)] p-1.5 font-mono"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[var(--ink-secondary)]">Góc xoay (°):</label>
                    <input
                      type="number"
                      step="5"
                      min="-180"
                      max="180"
                      disabled={isLocked}
                      value={selectedArtwork.rotation}
                      onChange={(e) =>
                        handleUpdateArtwork(
                          selectedArtwork.x,
                          selectedArtwork.y,
                          selectedArtwork.scale,
                          Number(e.target.value),
                        )
                      }
                      className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-surface)] p-1.5 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Prepress Lock Toggle */}
          <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-2">
            <span className="font-medium text-[var(--ink-primary)]">Khóa thông số Prepress:</span>
            <button
              type="button"
              onClick={() => setIsLocked(!isLocked)}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                isLocked
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              }`}
            >
              {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              <span>{isLocked ? "ĐÃ KHÓA" : "ĐANG MỞ"}</span>
            </button>
          </div>
        </div>

        {/* Center/Right 2 Cols: Interactive 2D Die-Cut SVG Visualizer */}
        <div className="flex flex-col justify-between space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xs lg:col-span-2">
          <div>
            <div className="mb-4 flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-[var(--ink-primary)]">
                  <FileCode className="h-4 w-4 text-[var(--brand)]" />
                  <span>Bản Vẽ Bế Phẳng 2D (Unrolled Conical Die-Cut)</span>
                </h3>
                <span className="text-xs text-[var(--ink-secondary)]">
                  Tỷ lệ trải phẳng thực tế: {printableWidthMm}mm x {heightMm}mm (Vùng an toàn Bleed{" "}
                  {bleedMm}mm)
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Vùng Bleed cắt ({bleedMm}mm)
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Vùng in an toàn
                </span>
              </div>
            </div>

            {/* SVG Visualizer Container */}
            <div className="relative flex aspect-16/9 w-full items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-900 p-6">
              {/* Die-Cut SVG Arc Outline */}
              <svg
                viewBox="0 0 600 320"
                className="h-full max-h-[300px] w-full"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Background Grid Lines */}
                <defs>
                  <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="600" height="320" fill="url(#grid)" />

                {/* Outer Die-Cut Bleed Boundary (Red dashed arc) */}
                <path
                  d="M 50 280 C 180 230, 420 230, 550 280 L 510 40 C 390 80, 210 80, 90 40 Z"
                  fill="#0f172a"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeDasharray="6,4"
                />

                {/* Inner Safe Printable Area (Emerald solid arc) */}
                <path
                  d="M 75 260 C 190 220, 410 220, 525 260 L 490 65 C 380 95, 220 95, 110 65 Z"
                  fill="#1e293b"
                  stroke="#10b981"
                  strokeWidth="1.5"
                />

                {/* Artwork Element 1: Logo */}
                {session.artworkElements.map((art) => {
                  const isCur = art.id === selectedArtwork.id;
                  // Map percentage to SVG coordinates inside the unrolled cup template
                  const svgX = 80 + (art.x / 100) * 440;
                  const svgY = 70 + (art.y / 100) * 180;
                  return (
                    <g
                      key={art.id}
                      transform={`translate(${svgX}, ${svgY}) rotate(${art.rotation}) scale(${art.scale})`}
                      className="cursor-pointer"
                      onClick={() => setSelectedArtId(art.id)}
                    >
                      <rect
                        x="-45"
                        y="-25"
                        width="90"
                        height="50"
                        rx="4"
                        fill={isCur ? "#3b82f6" : "#475569"}
                        stroke={isCur ? "#93c5fd" : "#64748b"}
                        strokeWidth="1.5"
                        opacity="0.9"
                      />
                      <text
                        x="0"
                        y="5"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="10"
                        fontWeight="bold"
                        fontFamily="sans-serif"
                      >
                        {art.name.substring(0, 15)}
                      </text>
                      {isCur && <circle cx="0" cy="0" r="3" fill="#fbbf24" />}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--border-default)] pt-3 sm:flex-row">
            <span className="text-xs text-[var(--ink-tertiary)]">
              💡 Bấm vào đối tượng trên bản vẽ để chọn và điều chỉnh tọa độ X/Y, Scale và Góc xoay.
            </span>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowExportModal(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-secondary)] shadow-xs hover:bg-[var(--bg-muted)] hover:text-[var(--ink-primary)]"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Xuất file khuôn DXF</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSyncMessage(
                    `Đã lưu thiết kế bản vẽ và đồng bộ Prepress sang Lệnh sản xuất LSX-2026-1002 lúc ${new Date().toLocaleTimeString("vi-VN")}`,
                  );
                  setTimeout(() => setSyncMessage(null), 5000);
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand)] px-4 py-1.5 text-xs font-bold text-[var(--ink-inverse)] shadow-xs hover:bg-[var(--brand-hover)]"
              >
                <span>Lưu & Đồng bộ Prepress</span>
              </button>
            </div>
          </div>

          {syncMessage && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-2.5 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{syncMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* DieCut Vector Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-bold text-[var(--ink-primary)]">
                  Xuất File Vector Khuôn Bế Bao Bì (Vector Die-Cut Export)
                </h3>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="rounded p-1 text-[var(--ink-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--ink-primary)]"
                aria-label="Đóng xuất file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3">
                <div className="mb-1 font-bold text-[var(--ink-primary)]">
                  Cấu trúc các lớp đồ họa Vector (CAD Layers):
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded border border-rose-300 bg-white p-2 dark:bg-black/40">
                    <span className="block text-[10px] font-bold text-rose-600">CUT_LINE</span>
                    <span className="text-[11px] text-[var(--ink-secondary)]">
                      Đường cắt viền ngoài (Dao bế 2pt)
                    </span>
                  </div>
                  <div className="rounded border border-blue-300 bg-white p-2 dark:bg-black/40">
                    <span className="block text-[10px] font-bold text-blue-600">CREASE_LINE</span>
                    <span className="text-[11px] text-[var(--ink-secondary)]">
                      Đường cấn gập đáy & thân
                    </span>
                  </div>
                  <div className="rounded border border-emerald-300 bg-white p-2 dark:bg-black/40">
                    <span className="block text-[10px] font-bold text-emerald-600">BLEED_BOX</span>
                    <span className="text-[11px] text-[var(--ink-secondary)]">
                      Tràn viền in ấn (+{bleedMm}mm)
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="font-sans text-[var(--ink-secondary)]">Chu vi miệng ly:</span>
                  <span className="font-bold tabular-nums">{(mouthMm * 3.14).toFixed(1)} mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-[var(--ink-secondary)]">Chu vi đáy ly:</span>
                  <span className="font-bold tabular-nums">{(bottomMm * 3.14).toFixed(1)} mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-[var(--ink-secondary)]">Chiều cao phôi bế:</span>
                  <span className="font-bold tabular-nums">{heightMm} mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-[var(--ink-secondary)]">
                    Định dạng CAD hỗ trợ:
                  </span>
                  <span className="font-sans font-semibold text-indigo-700 dark:text-indigo-400">
                    AutoCAD DXF R12 / SVG Vector 1:1
                  </span>
                </div>
              </div>

              <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <strong>Giả định Demo:</strong> File vector được tạo theo tỷ lệ hình học chuẩn 1:1
                cho máy bế phẳng CNC.
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-2">
              <span className="text-[11px] text-[var(--ink-tertiary)]">
                Tương thích Illustrator, Corel & AutoCAD
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--ink-secondary)] hover:bg-[var(--bg-muted)]"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400"><path d="M 120 40 L 680 40 L 590 320 L 210 320 Z" fill="none" stroke="#ef4444" stroke-width="2"/><text x="400" y="180" text-anchor="middle" font-family="sans-serif" font-size="16">DIE-CUT EXPORT: ${(mouthMm * 3.14).toFixed(0)}x${heightMm}mm</text></svg>`;
                    const blob = new Blob([svgContent], { type: "image/svg+xml" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `diecut-${mouthMm}x${bottomMm}x${heightMm}mm.svg`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Tải file SVG Vector</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { notFound } from "next/navigation";
import { PreviewNav } from "./components/PreviewNav";

export const metadata = {
  title: "StockFlow UI Preview — Kiểm thử giao diện nội bộ",
  description: "Trình duyệt kiểm thử UI-only độc lập cho các màn hình StockFlowCommerce",
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  // Guard bảo vệ môi trường: Chỉ chạy trong môi trường development, chặn tuyệt đối trên production (Issue #3)
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-base)] font-sans text-[var(--ink-primary)]">
      <PreviewNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      <footer className="border-t border-[var(--border-default)] bg-[var(--bg-surface)] py-4 text-center text-xs text-[var(--ink-tertiary)]">
        StockFlowCommerce · Chế độ xem trước nội bộ Antigravity · Mock In-Memory · Không phụ thuộc
        Backend
      </footer>
    </div>
  );
}

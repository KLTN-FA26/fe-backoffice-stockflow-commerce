import { PreviewNav } from "./components/PreviewNav";

export const metadata = {
  title: "StockFlow UI Preview — Kiểm thử giao diện nội bộ",
  description: "Trình duyệt kiểm thử UI-only độc lập cho các màn hình StockFlowCommerce",
};

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--ink-primary)] flex flex-col font-sans">
      <PreviewNav />
      <main className="flex-1 w-full mx-auto max-w-7xl px-4 sm:px-6 py-6">
        {children}
      </main>
      <footer className="border-t border-[var(--border-default)] bg-[var(--bg-surface)] py-4 text-center text-xs text-[var(--ink-tertiary)]">
        StockFlowCommerce · Chế độ xem trước nội bộ Antigravity · Mock In-Memory · Không phụ thuộc Backend
      </footer>
    </div>
  );
}

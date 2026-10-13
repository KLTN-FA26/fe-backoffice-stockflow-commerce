"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send } from "lucide-react";
import { batch2Repo } from "../mock-repo";
import { ChatMessage } from "../types";

export function StorefrontChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => batch2Repo.getChatMessages());
  const [inputVal, setInputVal] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages]);

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputVal).trim();
    if (!text) return;

    batch2Repo.sendCustomerMessage(text);
    setMessages([...batch2Repo.getChatMessages()]);
    setInputVal("");
  };

  const initialQuickChips = [
    "Báo giá in ly giấy 500ml",
    "Tư vấn số lượng tối thiểu (MOQ)",
    "Quy cách làm mẫu thử",
    "Tiến độ đơn hàng của tôi",
  ];

  return (
    <div className="relative">
      {/* Inline Demo View Container for the Workshop Hub */}
      <div className="space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-default)] pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink-primary)]">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
              <span>
                Widget Tư Vấn Trực Tuyến Khách Hàng (Storefront Floating Chat — SCRUM-320)
              </span>
            </h2>
            <p className="text-xs text-[var(--ink-secondary)]">
              Khung chat nổi nhúng tại trang Storefront; tư vấn tức thời kỹ thuật in, báo giá và
              kiểm tra tiến độ đơn hàng (Không phụ thuộc WebSocket backend).
            </p>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-[var(--brand)] px-4 py-2 text-xs font-bold text-[var(--ink-inverse)] shadow-xs transition-colors hover:bg-[var(--brand-hover)]"
          >
            <MessageSquare className="h-4 w-4" />
            <span>{isOpen ? "Thu nhỏ Widget Chat" : "Mở Bung Widget Chat"}</span>
          </button>
        </div>

        <p className="text-xs text-[var(--ink-secondary)]">
          Bấm nút &ldquo;Mở Bung Widget Chat&rdquo; bên trên hoặc biểu tượng trò chuyện màu xanh nổi
          ở góc dưới bên phải màn hình để thử nghiệm trải nghiệm khách hàng tương tác.
        </p>

        {/* Quick Chip Interactive Demonstration Section */}
        <div className="space-y-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4 text-xs">
          <span className="block font-semibold text-[var(--ink-primary)]">
            Các câu hỏi gợi ý thường gặp (Bấm để gửi nhanh vào chat):
          </span>
          <div className="flex flex-wrap gap-2">
            {initialQuickChips.map((chip) => (
              <button
                key={chip}
                onClick={() => {
                  setIsOpen(true);
                  handleSendMessage(chip);
                }}
                className="rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--ink-primary)] transition-all hover:border-[var(--brand)] hover:bg-[var(--bg-muted)]"
              >
                💬 {chip}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Trigger Button (Always fixed at bottom-right) */}
      <div className="fixed right-6 bottom-6 z-50 flex flex-col items-end">
        {/* Floating Chat Drawer Window */}
        {isOpen && (
          <div className="animate-in fade-in slide-in-from-bottom-5 mb-3 flex h-[480px] w-80 flex-col overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-2xl transition-all sm:w-96">
            {/* Header */}
            <div className="flex items-center justify-between bg-[var(--brand)] p-3 text-[var(--ink-inverse)] shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
                    SF
                  </div>
                  <span className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[var(--brand)]" />
                </div>
                <div>
                  <div className="text-xs font-bold">Minh Anh · Tư vấn viên StockFlow</div>
                  <div className="text-[10px] text-white/80">
                    Sẵn sàng hỗ trợ trực tuyến (Phản hồi &lt; 2p)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded p-1 text-white transition-colors hover:bg-white/10"
                  title="Đóng chat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Message Area */}
            <div className="flex-1 space-y-3 overflow-y-auto bg-[var(--bg-subtle)] p-4 text-xs">
              {messages.map((m) => {
                const isUser = m.sender === "CUSTOMER";
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    <span className="mb-1 px-1 text-[10px] text-[var(--ink-tertiary)]">
                      {m.senderName} · {m.timestamp}
                    </span>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs ${
                        isUser
                          ? "rounded-br-xs bg-[var(--brand)] text-[var(--ink-inverse)]"
                          : "rounded-bl-xs border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--ink-primary)]"
                      }`}
                    >
                      {m.text}
                    </div>

                    {/* Quick action chips inside consultant message */}
                    {m.quickChips && m.quickChips.length > 0 && (
                      <div className="mt-2 flex max-w-[90%] flex-wrap gap-1.5">
                        {m.quickChips.map((chip, cIdx) => (
                          <button
                            key={cIdx}
                            onClick={() => handleSendMessage(chip)}
                            className="rounded-full border border-[var(--border-default)] bg-white px-2.5 py-1 text-left text-[11px] font-medium text-[var(--brand)] transition-colors hover:bg-sky-50 dark:bg-slate-800"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2 border-t border-[var(--border-default)] bg-[var(--bg-surface)] p-2.5"
            >
              <input
                type="text"
                placeholder="Nhập câu hỏi cần tư vấn..."
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="flex-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-xs text-[var(--ink-primary)] focus:border-[var(--brand)] focus:outline-hidden"
              />
              <button
                type="submit"
                disabled={!inputVal.trim()}
                className="shrink-0 rounded-md bg-[var(--brand)] p-2 text-[var(--ink-inverse)] shadow-xs transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {/* Floating Bubble Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--ink-inverse)] shadow-2xl transition-all hover:scale-105 active:scale-95"
          aria-label="Mở cửa sổ tư vấn trực tuyến"
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <>
              <MessageSquare className="h-6 w-6" />
              <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold ring-2 ring-white">
                1
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { DollarSign, Users, KeyRound } from "lucide-react";
import { B2BQuote } from "@/features/ui-b2b/types";
import { b2bRepo } from "@/features/ui-b2b/mock-repo";
import { B2BQuoteList } from "@/features/ui-b2b/components/B2BQuoteList";
import { CustomerQuotePortalView } from "@/features/ui-b2b/components/CustomerQuotePortalView";
import { B2BCustomerList } from "@/features/ui-b2b/components/B2BCustomerList";
import { CustomerPortalActivationView } from "@/features/ui-b2b/components/CustomerPortalActivationView";

type Tab = "quotes" | "quote-portal" | "customers" | "activation";

export default function B2BPreviewPage() {
  const [activeTab, setActiveTab] = useState<Tab>("quotes");
  const [selectedQuote, setSelectedQuote] = useState<B2BQuote>(b2bRepo.getQuotes()[0]);
  const [activationToken, setActivationToken] = useState<string>("token-invite-gsp");
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-default)] pb-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-amber-600 font-mono text-xs font-bold text-white">
              D
            </span>
            <h1 className="text-xl font-bold text-[var(--ink-primary)]">
              Nhóm D: Khách Hàng B2B & Báo Giá Bậc & Onboarding
            </h1>
          </div>
          <p className="mt-1 text-xs text-[var(--ink-secondary)]">
            Phạm vi: <strong>SCRUM-449</strong> (Sales báo giá bậc tier pricing & Portal khách duyệt
            có guard BR-PRD-08), <strong>SCRUM-451</strong> (Tạo khách B2B, gửi thư mời & Trang kích
            hoạt portal).
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 text-xs">
          <button
            onClick={() => setActiveTab("quotes")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "quotes"
                ? "bg-[var(--brand)] font-semibold text-[var(--ink-inverse)] shadow-xs"
                : "text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            1. DS Báo Giá (Sales)
          </button>
          <button
            onClick={() => setActiveTab("quote-portal")}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "quote-portal"
                ? "bg-amber-600 font-semibold text-white shadow-xs"
                : "text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            <DollarSign className="h-3.5 w-3.5" />
            <span>2. Portal Khách Duyệt Giá</span>
          </button>
          <button
            onClick={() => setActiveTab("customers")}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "customers"
                ? "bg-sky-600 font-semibold text-white shadow-xs"
                : "text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>3. Hồ Sơ Khách B2B</span>
          </button>
          <button
            onClick={() => setActiveTab("activation")}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "activation"
                ? "bg-emerald-600 font-semibold text-white shadow-xs"
                : "text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>4. Kích Hoạt Portal</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div key={refreshKey}>
        {activeTab === "quotes" && (
          <B2BQuoteList
            onSelectQuote={(q) => {
              setSelectedQuote(q);
              setActiveTab("quote-portal");
            }}
            onOpenPortal={(q) => {
              setSelectedQuote(q);
              setActiveTab("quote-portal");
            }}
            onRefresh={triggerRefresh}
          />
        )}

        {activeTab === "quote-portal" && (
          <CustomerQuotePortalView
            quote={selectedQuote}
            onBack={() => setActiveTab("quotes")}
            onRefresh={triggerRefresh}
          />
        )}

        {activeTab === "customers" && (
          <B2BCustomerList
            onSelectCustomerActivation={(token) => {
              setActivationToken(token);
              setActiveTab("activation");
            }}
            onRefresh={triggerRefresh}
          />
        )}

        {activeTab === "activation" && (
          <CustomerPortalActivationView
            initialToken={activationToken}
            onBack={() => setActiveTab("customers")}
            onRefresh={triggerRefresh}
          />
        )}
      </div>
    </div>
  );
}

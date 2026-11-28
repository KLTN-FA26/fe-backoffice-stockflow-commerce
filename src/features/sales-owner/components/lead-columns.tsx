"use client";

import { Ban, History, PhoneCall, UserPlus, UserRoundPlus } from "lucide-react";

import { customerCreateFromLead } from "@/constants/sales-owner";

import { formatDate } from "@/lib/format/date";

import { CELL, ToneDot } from "@/components/shared/column-helpers";
import { rowActionsColumn } from "@/components/shared/RowActionsMenu";

import { leadActions } from "../lifecycle";
import { leadInterestsLabel, leadStatusLabel } from "../selectors";

import type { LeadStatus } from "@/constants/sales-owner";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { RowAction } from "@/components/shared/RowActionsMenu";
import type { LeadAction } from "../lifecycle";
import type { Lead } from "../types";

const TONE: Record<LeadStatus, "info" | "warning" | "positive" | "muted" | "neutral"> = {
  NEW: "warning",
  ASSIGNED: "info",
  CONTACTED: "info",
  CONVERTED: "positive",
  DISQUALIFIED: "muted",
};

const DATA: ColumnDef<Lead>[] = [
  {
    key: "company",
    header: "Công ty",
    className: "min-w-52",
    cell: (l) => (
      <div className="flex flex-col">
        <span className={CELL.name}>{l.companyName}</span>
        {l.taxCode && <span className={CELL.sub}>MST {l.taxCode}</span>}
      </div>
    ),
  },
  {
    key: "contact",
    header: "Người liên hệ",
    className: "min-w-44",
    cell: (l) => (
      <div className="flex flex-col">
        <span className={CELL.text}>
          {l.contactName ?? "—"}
          {l.contactTitle ? ` · ${l.contactTitle}` : ""}
        </span>
        <span className={CELL.sub}>{[l.phone, l.email].filter(Boolean).join(" · ")}</span>
      </div>
    ),
  },
  { key: "province", header: "Tỉnh / thành", cell: (l) => l.province ?? "—" },
  {
    key: "interests",
    header: "Quan tâm",
    className: "min-w-32 whitespace-normal",
    cell: (l) => leadInterestsLabel(l.interests),
  },
  {
    key: "volume",
    header: "Sản lượng / tháng",
    cell: (l) => (l.monthlyVolume == null ? "—" : String(l.monthlyVolume)),
  },
  {
    key: "status",
    header: "Trạng thái",
    cell: (l) => (
      <ToneDot tone={TONE[l.status as LeadStatus] ?? "neutral"} label={leadStatusLabel(l.status)} />
    ),
  },
  { key: "assignedTo", header: "Sale được giao", cell: (l) => l.assignedToName ?? "—" },
  {
    key: "createdAt",
    header: "Ngày gửi",
    align: "right",
    cell: (l) => <span className={CELL.date}>{l.createdAt ? formatDate(l.createdAt) : "—"}</span>,
  },
];

/** Mục menu của mỗi thao tác cho phép (`leadActions`, §10.7). "Chuyển thành khách" mở form tạo khách điền sẵn. */
function menu(lead: Lead, allowed: LeadAction[], open: (action: LeadAction, lead: Lead) => void) {
  const items: RowAction[] = [];
  if (allowed.includes("assign"))
    items.push({
      label: lead.assignedTo ? "Giao lại cho Sale khác…" : "Giao cho Sale…",
      icon: UserRoundPlus,
      onSelect: () => open("assign", lead),
    });
  if (allowed.includes("contact"))
    items.push({ label: "Đã liên hệ…", icon: PhoneCall, onSelect: () => open("contact", lead) });
  if (allowed.includes("convert"))
    items.push({
      label: "Chuyển thành khách",
      icon: UserPlus,
      href: customerCreateFromLead({
        leadId: lead.id,
        companyName: lead.companyName,
        taxCode: lead.taxCode,
        contactName: lead.contactName,
        email: lead.email,
        phone: lead.phone,
      }),
    });
  if (allowed.includes("disqualify"))
    items.push({
      label: "Loại…",
      icon: Ban,
      danger: true,
      onSelect: () => open("disqualify", lead),
    });
  return items;
}

/** `onDetail`: "Xem chi tiết và lịch sử" — luôn có, kể cả lead đã xử lý xong (bấm dòng cũng mở). */
export function leadColumns(
  ctx: Parameters<typeof leadActions>[1],
  open: (action: LeadAction, lead: Lead) => void,
  onDetail: (lead: Lead) => void,
): ColumnDef<Lead>[] {
  return [
    ...DATA,
    rowActionsColumn<Lead>((lead) => {
      const items = menu(lead, leadActions(lead, ctx), open);
      return {
        label: `Thao tác — ${lead.companyName}`,
        actions: [
          { label: "Xem chi tiết và lịch sử", icon: History, onSelect: () => onDetail(lead) },
          ...(items.length
            ? items
            : [
                {
                  label: "Không có thao tác",
                  disabled: true,
                  hint: "Lead đã xử lý xong hoặc không phải của bạn.",
                },
              ]),
        ],
      };
    }),
  ];
}

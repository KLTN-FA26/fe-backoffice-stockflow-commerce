"use client";

import { ADMIN_ROUTES, ORDER_PERMISSIONS, QUOTE_PERMISSIONS } from "@/constants";
import { CHAT_INBOX_LABELS } from "@/constants/labels-chat";
import { formatMoney } from "@/lib/format/money";
import { PermittedLink } from "@/components/backoffice/PermittedLink";

import { openDocuments } from "../inbox-view";
import { contextStatusLabel } from "../selectors";

import type { PermissionCode } from "@/lib/auth";
import type { ChatCustomerOverview } from "../schemas";

type Document = ChatCustomerOverview["quotes"][number];

/** Một chứng từ: số (link nếu mở được trang đích) + trạng thái bên trái, số tiền bên phải không bị cắt. */
function Row({
  doc,
  kind,
  href,
  permission,
}: {
  doc: Document;
  kind: "QUOTE" | "ORDER";
  href: string;
  permission: PermissionCode;
}) {
  const number = doc.number ?? doc.id;
  return (
    <li className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <PermittedLink
          permission={permission}
          href={href}
          className="text-accent-text font-[family-name:var(--font-mono)] break-all hover:underline"
          fallback={<span className="font-[family-name:var(--font-mono)] break-all">{number}</span>}
        >
          {number}
        </PermittedLink>
        {doc.status && (
          <span className="text-ink-tertiary"> · {contextStatusLabel(kind, doc.status)}</span>
        )}
      </div>
      {doc.amount != null && (
        <span className="shrink-0 whitespace-nowrap tabular-nums">
          {formatMoney(doc.amount, doc.currency ?? "VND")}
        </span>
      )}
    </li>
  );
}

/**
 * "Báo giá / đơn đang mở" của khách ngay trong chat (UI/UX bo-33): đọc từ hồ sơ khách S16 (10 chứng từ gần nhất mỗi
 * loại), chỉ giữ báo giá còn chờ và đơn còn chạy. Link chỉ khi mở được trang đích (VIEW_PAGE, AUTH-8).
 */
export function OpenDocuments({ overview }: { overview: ChatCustomerOverview | undefined }) {
  const { quotes, orders } = openDocuments(overview);
  return (
    <div className="space-y-1">
      <h3 className="text-ink-secondary text-xs font-medium">{CHAT_INBOX_LABELS.openDocuments}</h3>
      {quotes.length === 0 && orders.length === 0 ? (
        <p className="text-ink-tertiary">{CHAT_INBOX_LABELS.noOpenDocuments}</p>
      ) : (
        <ul className="space-y-1">
          {quotes.map((doc) => (
            <Row
              key={doc.id}
              doc={doc}
              kind="QUOTE"
              href={ADMIN_ROUTES.quotes.detail(doc.id)}
              permission={QUOTE_PERMISSIONS.viewPage}
            />
          ))}
          {orders.map((doc) => (
            <Row
              key={doc.id}
              doc={doc}
              kind="ORDER"
              href={ADMIN_ROUTES.orders.detail(doc.id)}
              permission={ORDER_PERMISSIONS.viewPage}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

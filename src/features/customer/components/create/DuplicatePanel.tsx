"use client";

import Link from "next/link";

import { ADMIN_ROUTES, CUSTOMER_CREATE_OWNER_LABELS } from "@/constants";
import { Notice } from "@/components/shared/Notice";

import type { CustomerDuplicate } from "@/features/customer/duplicates";

const L = CUSTOMER_CREATE_OWNER_LABELS.duplicates;

/** "Trùng MST, SĐT" — khoá BE lạ thì giữ nguyên. */
function matchedText(matchedOn: readonly string[]): string | null {
  if (matchedOn.length === 0) return null;
  return `${L.matchedPrefix} ${matchedOn.map((key) => L.matchedOn[key] ?? key).join(", ")}`;
}

/**
 * Cảnh báo khách có thể trùng khi tạo hồ sơ (BR-S14, tình huống 16): mỗi khách khớp một dòng — tên (link tới hồ sơ), trùng
 * ô nào, ai đang phụ trách. Chỉ cảnh báo, không chặn (trùng MST BE tự chặn).
 */
export function DuplicatePanel({ matches }: { matches: readonly CustomerDuplicate[] }) {
  if (matches.length === 0) return null;
  return (
    <section aria-label={L.title}>
      <Notice tone="warning" live>
        <span className="block font-medium">{L.title}</span>
        <span className="text-ink-secondary block text-xs">{L.description}</span>
        <ul className="mt-2 space-y-1">
          {matches.map((match) => {
            const facts = [
              matchedText(match.matchedOn),
              match.salesOwnerName ? L.owner(match.salesOwnerName) : L.noOwner,
            ].filter((fact): fact is string => fact !== null);
            return (
              <li key={match.customerId} className="text-[0.8125rem]">
                <Link
                  href={ADMIN_ROUTES.customers.detail(match.customerId)}
                  className="text-ink-primary font-medium hover:underline"
                >
                  {match.fullName ?? L.open}
                </Link>
                <span className="text-ink-secondary"> — {facts.join(" · ")}</span>
              </li>
            );
          })}
        </ul>
      </Notice>
    </section>
  );
}

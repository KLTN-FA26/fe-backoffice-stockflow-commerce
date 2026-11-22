"use client";

import { ListOrdered } from "lucide-react";

import { SLOTTING_LABELS } from "@/constants";
import { DetailSection } from "@/components/shared/DetailSection";

const R = SLOTTING_LABELS.rules;

function Block({
  title,
  items,
  ordered,
}: {
  title: string;
  items: readonly string[];
  ordered?: boolean;
}) {
  const List = ordered ? "ol" : "ul";
  return (
    <div className="space-y-1.5">
      <h3 className="text-ink-primary text-[0.8125rem] font-semibold">{title}</h3>
      <List
        className={`text-ink-secondary space-y-1 pl-5 text-[0.8125rem] ${ordered ? "list-decimal" : "list-disc"}`}
      >
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </List>
    </div>
  );
}

/**
 * Giải thích quy tắc gợi ý vị trí (docs 05 §4.3, BR-04/05/13; docs 06 §4.4) — chỉ đọc. BE không có API cấu hình
 * slotting (bảng `slotting_rule` chưa có chức năng, docs 06 §1), nên trang không có thao tác sửa quy tắc.
 */
export function SlottingRulesCard() {
  return (
    <DetailSection title={R.title} icon={ListOrdered}>
      <div className="space-y-4">
        <p className="text-ink-tertiary text-xs">{R.fixed}</p>
        <Block title={R.filterTitle} items={R.filters} />
        <Block title={R.orderTitle} items={R.order} ordered />
        <Block title={R.tieTitle} items={R.ties} />
        <p className="text-ink-secondary border-t border-(--table-line) pt-3 text-[0.8125rem]">
          {R.overflow}
        </p>
      </div>
    </DetailSection>
  );
}

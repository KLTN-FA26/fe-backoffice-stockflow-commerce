"use client";

import Link from "next/link";
import { FileText } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { PageHeader } from "@/components/shared/PageHeader";

export function PoNotFound({ id }: { id: string }) {
  return (
    <>
      <PageHeader title="Không tìm thấy PO" subtitle="Đơn đặt NCC không tồn tại hoặc đã bị xoá." />
      <div className="text-ink-tertiary flex flex-col items-center justify-center py-20">
        <FileText className="mb-3 size-12 opacity-40" />
        <p className="text-[0.9375rem]">
          Đơn đặt hàng <code className="text-accent font-[family-name:var(--font-mono)]">{id}</code>{" "}
          không tồn tại.
        </p>
        <Link
          href={ADMIN_ROUTES.purchaseOrders.list}
          className="text-accent mt-4 text-[0.8125rem] hover:underline"
        >
          Quay lại danh sách
        </Link>
      </div>
    </>
  );
}

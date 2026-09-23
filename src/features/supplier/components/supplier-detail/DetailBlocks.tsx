import type { SupplierDto } from "@/features/supplier/types";

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border-default/60 flex items-start justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-ink-secondary shrink-0 text-[0.8125rem]">{label}</span>
      <span className="text-ink-primary text-right text-[0.875rem] font-medium">{value}</span>
    </div>
  );
}

export function AddressBlock({ address }: { address: SupplierDto["address"] }) {
  if (!address) return <span className="text-ink-secondary text-[0.8125rem]">—</span>;
  const line1 = `${address.street}, ${address.ward}`;
  const line2 = `${address.district}, ${address.province} ${address.postalCode}`;
  return (
    <div className="text-ink-primary text-[0.875rem] font-medium">
      <div>{line1}</div>
      <div>{line2}</div>
      <div className="text-ink-secondary text-[0.8125rem]">{address.country}</div>
    </div>
  );
}

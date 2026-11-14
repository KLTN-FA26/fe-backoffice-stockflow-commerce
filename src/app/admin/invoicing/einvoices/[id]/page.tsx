import { EInvoiceDetail } from "@/features/einvoice";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EInvoiceDetail id={id} />;
}

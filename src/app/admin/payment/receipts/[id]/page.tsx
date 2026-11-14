import { ReceiptDetail } from "@/features/payment";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReceiptDetail id={id} />;
}

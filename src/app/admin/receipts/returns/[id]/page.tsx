import { ReturnReceiptDetail } from "@/features/return";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReturnReceiptDetail id={id} />;
}

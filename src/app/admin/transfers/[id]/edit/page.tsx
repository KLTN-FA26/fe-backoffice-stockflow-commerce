import { TransferEdit } from "@/features/transfer/components/TransferEdit";

export default async function TransferEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TransferEdit id={id} />;
}

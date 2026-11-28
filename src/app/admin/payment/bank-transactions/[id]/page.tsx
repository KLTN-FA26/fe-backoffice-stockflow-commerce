import { BankTransactionDetail } from "@/features/bank-transaction";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BankTransactionDetail id={id} />;
}

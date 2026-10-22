import { QuoteDetail } from "@/features/quote";

export default async function QuoteDetailPage({ params }: PageProps<"/admin/quotes/[id]">) {
  const { id } = await params;
  return <QuoteDetail id={id} />;
}

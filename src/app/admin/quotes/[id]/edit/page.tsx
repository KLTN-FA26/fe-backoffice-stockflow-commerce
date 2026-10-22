import { QuoteEdit } from "@/features/quote";

export default async function QuoteEditPage({ params }: PageProps<"/admin/quotes/[id]/edit">) {
  const { id } = await params;
  return <QuoteEdit id={id} />;
}
